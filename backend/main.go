package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type App struct {
	db          Database
	storage     CloudStorage
	secrets     map[string]string
	inDebugMode bool
	maxFileSize int64
}

func NewApp() (App, error) {
	secrets := readEnvironmentVariables()

	debugVar := os.Getenv("DEBUG_MODE")
	mode := strings.Trim(debugVar, " ")
	if len(mode) == 0 {
		panic("DEBUG_MODE environment variable not set")
	}
	inDebugMode := mode == "1"

	db, err := NewDatabase(secrets["DATABASE_URL"])
	if err != nil {
		return App{}, err
	}

	storage, err := NewCloudStorage(secrets)
	if err != nil {
		return App{}, err
	}
	storage.allowedMimetypes = []string{"image/png", "image/jpeg"}

	maxFileSize := int64(32 << 20) // 32 megabytes

	return App{db, storage, secrets, inDebugMode, maxFileSize}, nil
}

func (app *App) maxUploadSize() int64 { return int64(app.maxFileSize * 5) }

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

// Upload a batch of files and respond with a list of corresponding file ids
func (app *App) UploadAssetBatch(ctx *gin.Context) {
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

	// Download the files
	files, ok := form.File["files"]
	if !ok {
		handleResponse(ctx, http.StatusBadRequest, "No attached files")
		return
	}

	fileIds := []string{}
	for _, file := range files {
		if file.Size > app.maxFileSize {
			msg := fmt.Sprintf("%s: too big", file.Filename)
			handleResponse(ctx, http.StatusBadRequest, msg)
			return
		}

		mimetype := file.Header.Get("Content-Type")
		if !slices.Contains(app.storage.allowedMimetypes, mimetype) {
			msg := fmt.Sprintf("%s: invalid file type", file.Filename)
			handleResponse(ctx, http.StatusBadRequest, msg)
			return
		}

		extension := filepath.Ext(file.Filename)
		filename := createRandomFilename(userId, extension)
		fileIds = append(fileIds, filename)

		reader, err := file.Open()
		if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}

		err = app.storage.UploadFile(context.TODO(), reader, filename)
		if err != nil {
			reader.Close()
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}

		reader.Close()
	}

	response := map[string]any{
		"files":  fileIds,
		"sucess": true,
	}
	handleResponse(ctx, http.StatusOK, response)
}

type GenerateFlashcardsData struct {
	NumCards int      `json:"numCards" binding:"required"`
	FilesIds []string `json:"fileIds" binding:"required"`
}

type BatchPromptTemplate struct{ NumCards int }

type CombinePromptTemplate struct {
	DeckSize int
	Cards    []Card
}

// Parse flashcard json info from the llm response
func extractCards(response map[string]any) ([]Card, error) {
	choices, ok := response["choices"].([]any)
	if !ok || len(choices) == 0 {
		return nil, errors.New("missing or invalid choices")
	}

	choice, ok := choices[0].(map[string]any)
	if !ok {
		return nil, errors.New("choice[0] is not a map")
	}

	message, ok := choice["message"].(map[string]any)
	if !ok {
		return nil, errors.New("missing or invalid message")
	}

	content, ok := message["content"].(string)
	if !ok {
		return nil, errors.New("missing or invalid content string")
	}

	var contentData struct {
		Cards []Card `json:"cards"`
	}
	err := json.Unmarshal([]byte(content), &contentData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse content JSON: %w", err)
	}

	return contentData.Cards, nil
}

func (app *App) createBatchPayload(
	data GenerateFlashcardsData, userId string) (*Payload, error) {
	templateData := BatchPromptTemplate{NumCards: data.NumCards}
	promptContent, err := parsePromptTemplate("prompts/batch.template", templateData)
	if err != nil {
		return nil, err
	}

	textPrompts := []Prompt{{Type: "text", Text: promptContent}}

	imagePrompts := []Prompt{}
	for _, id := range data.FilesIds {
		file, mimetype, err := app.storage.GetFile(context.TODO(), id)
		if err != nil {
			return nil, err
		}

		content, err := base64EncodeFile(file, mimetype)
		if err != nil {
			file.Close()
			return nil, err
		}

		file.Close()

		prompt := Prompt{
			Type:  "image_url",
			Image: &ImageUrl{Url: content},
		}
		imagePrompts = append(imagePrompts, prompt)
	}

	payload := Payload{
		Model:  "meta-llama/llama-4-scout-17b-16e-instruct",
		UserId: userId,
		Messages: []Message{
			{Role: "user", Content: imagePrompts},
			{Role: "user", Content: textPrompts},
		},
		ResponseFormat: map[string]string{"type": "json_object"},
		Temperature:    0.8,
	}
	return &payload, nil
}

// Use the LLM to generate a set of flashcards from a batch of files
// Return the newly created batch of flashcards
func (app *App) GenerateFlashcards(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	var data GenerateFlashcardsData
	if err := ctx.ShouldBindJSON(&data); err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	if len(data.FilesIds) == 0 {
		handleResponse(ctx, http.StatusBadRequest, "No files were provided")
		return
	}

	payload, err := app.createBatchPayload(data, userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	cards, err := promptGroqLLM(*payload, app.secrets["GROQ_API_KEY"], extractCards)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"cards": cards}
	handleResponse(ctx, http.StatusOK, response)
}

type CreateDeckData struct {
	Name     string `json:"name" binding:"required"`
	DeckSize int    `json:"numCards" binding:"required"`
	Cards    []Card `json:"cards" binding:"required"`
}

func (app *App) createCombinePayload(
	userId string, cards []Card, deckSize int) (*Payload, error) {
	t := CombinePromptTemplate{DeckSize: deckSize, Cards: cards}
	promptContent, err := parsePromptTemplate("prompts/combine.template", t)
	if err != nil {
		return nil, err
	}

	payload := Payload{
		Model:  "meta-llama/llama-4-scout-17b-16e-instruct",
		UserId: userId,
		Messages: []Message{
			{Role: "user", Content: []Prompt{{Type: "text", Text: promptContent}}},
		},
		ResponseFormat: map[string]string{"type": "json_object"},
		Temperature:    0.8,
	}
	return &payload, nil
}

// Create a flashcard deck from a batch of flashcard decks. In order
// to preserve the llm's context window, we're splitting the user's
// asset uploads into batches and generating flashcards from said
// batches. Once we've processed all the batches, we then combine
// and trim the generated flashcards into a high quality set of flashcards.
// That will be the final flashcard deck that's given to the user
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

	payload, err := app.createCombinePayload(userId, data.Cards, data.DeckSize)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	cards, err := promptGroqLLM(*payload, app.secrets["GROQ_API_KEY"], extractCards)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	err = app.db.insertDeck(userId, Deck{Name: data.Name, Cards: cards})
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"name": data.Name, "cards": cards}
	handleResponse(ctx, http.StatusOK, response)
}

func main() {
	app, err := NewApp()
	if err != nil {
		panic(err)
	}
	defer app.db.Close()

	if app.inDebugMode {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	server := gin.Default()
	server.MaxMultipartMemory = app.maxUploadSize()

	server.POST("/authenticate", app.AuthenticateUser)
	server.POST("/uploadFiles", app.UploadAssetBatch)
	server.POST("/generateFlashcards", app.GenerateFlashcards)
	server.POST("/createDeck", app.CreateDeck)
	server.GET("/userInfo", app.GetUserInfo)
	if err := server.Run(); err != nil {
		panic(err)
	}
}
