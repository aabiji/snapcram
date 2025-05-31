package main

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type App struct {
	db          Database
	secrets     map[string]string
	maxFileSize int64
}

func NewApp() (App, error) {
	secrets := readEnvironmentVariables()

	db, err := NewDatabase(secrets["DATABASE_URL"])
	if err != nil {
		return App{}, err
	}

	maxFileSize := int64(32 << 20) // 32 megabytes
	return App{db, secrets, maxFileSize}, nil
}

// Each batch should hold at most 5 files
func (app *App) fileUploadLimit() int64 { return app.maxFileSize * 5 }

func (app *App) inDebugMode() bool {
	debugVar := app.secrets["DEBUG_MODE"]
	mode := strings.Trim(debugVar, " ")
	if len(mode) == 0 {
		panic("DEBUG_MODE environment variable not set")
	}
	return mode == "1"
}

// Write response json that either holds an error message or some custom data
func handleResponse(ctx *gin.Context, statusCode int, object any) {
	message := "unacceptable request"
	if statusCode == http.StatusNotFound {
		message = "Page not found!"
	} else if statusCode == http.StatusInternalServerError {
		message = "Internal server error"
	} else if statusCode == http.StatusBadRequest {
		message = "Invalid request"
	}

	if statusCode != http.StatusOK {
		ctx.JSON(statusCode, gin.H{
			"error": message, "details": object,
		})
	} else {
		ctx.JSON(statusCode, object)
	}
}

// Extract the user'd ID from the request header and
// ensure the user exists, then return it
func (app *App) getUserID(ctx *gin.Context) (string, error) {
	tokenStr := ctx.GetHeader("Authorization")
	if len(strings.Trim(tokenStr, " ")) == 0 {
		return "", fmt.Errorf("no jwt found")
	}

	if tokenStr[0] == '"' { // Remove quotes if present
		tokenStr = tokenStr[1 : len(tokenStr)-1]
	}
	token, err := parseToken(tokenStr, []byte(app.secrets["JWT_SECRET"]))
	if err != nil {
		return "", fmt.Errorf("invalid json web token")
	}

	// Check if the token is about to get expired
	expiryTime, err := token.Claims.GetExpirationTime()
	if err != nil {
		return "", err
	}

	closeToExpiring := time.Until(expiryTime.Time).Hours() <= 24
	if closeToExpiring {
		return "", jwt.ErrTokenExpired
	}

	userId, err := token.Claims.GetSubject()
	if err != nil {
		return "", fmt.Errorf("json web token doesn't contain the user's id")
	}

	exists, err := app.db.userExists(userId)
	if err != nil {
		return "", err
	}

	if !exists {
		return "", fmt.Errorf("user not found")
	}

	return userId, nil
}

type AuthUserData struct {
	Email           string `json:"email" binding:"required"`
	Password        string `json:"password" binding:"required"`
	ExistingAccount *bool  `json:"existing" binding:"required"`
}

func (app *App) AuthenticateUser(ctx *gin.Context) {
	var data AuthUserData
	if err := ctx.ShouldBindJSON(&data); err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	userId, err := app.db.validateUserCredentials(data.Email, data.Password)

	if *data.ExistingAccount { // Loggin in
		if err == ErrUserNotFound || err == ErrWrongPassword {
			handleResponse(ctx, http.StatusNotAcceptable, err.Error())
			return
		} else if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}
	} else { // Creating an account
		if err == nil {
			handleResponse(ctx, http.StatusNotAcceptable, "user already exists")
			return
		} else if err != ErrUserNotFound {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}

		// Insert a new user into the database
		userId = uuid.NewString()
		err := app.db.insertUser(data.Email, data.Password, userId)
		if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}
	}

	// Respond with a json web token containing the user id
	tokenStr, err := createToken([]byte(app.secrets["JWT_SECRET"]), userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]string{"token": tokenStr}
	handleResponse(ctx, http.StatusOK, response)
}

// Response with all of the user's decks
func (app *App) GetUserInfo(ctx *gin.Context) {
	response := map[string]any{"decks": nil, "tokenExpired": true}

	userId, err := app.getUserID(ctx)
	if err == jwt.ErrTokenExpired {
		handleResponse(ctx, http.StatusOK, response)
		return
	} else if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	decks, err := app.db.getDecks(userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response["decks"] = decks
	response["tokenExpired"] = false
	handleResponse(ctx, http.StatusOK, response)
}

// Generate a set of flashcards using the uploaded files. Those
// flashcards will then be used to create a flashcard deck
func (app *App) GenerateFlashcards(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, err.Error())
		return
	}

	form, err := ctx.MultipartForm()
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	files, ok := form.File["files"]
	if !ok {
		handleResponse(ctx, http.StatusBadRequest, "No attached files")
		return
	}

	// Make sure the uploaded files are valid
	allowedMimetypes := []string{"image/png", "image/jpeg"}
	for _, file := range files {
		if file.Size > app.maxFileSize {
			msg := fmt.Sprintf("%s: too big", file.Filename)
			handleResponse(ctx, http.StatusBadRequest, msg)
			return
		}

		mimetype := file.Header.Get("Content-Type")
		if !slices.Contains(allowedMimetypes, mimetype) {
			msg := fmt.Sprintf("%s: invalid file type", file.Filename)
			handleResponse(ctx, http.StatusBadRequest, msg)
			return
		}
	}

	flashcards, err := createFlashcardDrafts(app.secrets["GROQ_API_KEY"], userId, files)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"cards": flashcards}
	handleResponse(ctx, http.StatusOK, response)
}

type CreateDeckData struct {
	Name           string `json:"name" binding:"required"`
	DeckSize       int    `json:"size" binding:"required"`
	FlashcardDrafs []Card `json:"drafts" binding:"required"`
}

// Create a flashcard deck using previously generated flashcard drafts
func (app *App) CreateDeck(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	var data CreateDeckData
	if err := ctx.ShouldBindJSON(&data); err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	cards, err := createFlashcardDeck(
		app.secrets["GROQ_API_KEY"], userId, data.FlashcardDrafs, data.DeckSize,
	)
	if err != nil {
		fmt.Println(err)
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	id, err := app.db.insertDeck(userId, Deck{Name: data.Name, Cards: cards})
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"name": data.Name, "cards": cards, "id": id}
	handleResponse(ctx, http.StatusOK, response)
}

type DeleteDeckData struct {
	ID int `json:"id" binding:"required"`
}

func (app *App) DeleteDeck(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	var data DeleteDeckData
	if err := ctx.ShouldBindJSON(&data); err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	err = app.db.deleteDeck(userId, data.ID)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	handleResponse(ctx, http.StatusOK, nil)
}

func main() {
	app, err := NewApp()
	if err != nil {
		panic(err)
	}
	defer app.db.Close()

	if app.inDebugMode() {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	server := gin.Default()
	server.MaxMultipartMemory = app.fileUploadLimit()

	server.GET("/userInfo", app.GetUserInfo)
	server.POST("/authenticate", app.AuthenticateUser)
	server.POST("/generate", app.GenerateFlashcards)
	server.PUT("/deck", app.CreateDeck)
	server.DELETE("/deck", app.DeleteDeck)

	if err := server.Run(); err != nil {
		panic(err)
	}
}
