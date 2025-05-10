package main

import (
	"database/sql"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"net/http"
	"path/filepath"
	"slices"
)

type App struct {
	db               *sql.DB
	jwtSecret        []byte
	groqApiKey       string
	fileUploadLimit  int64
	fileSizeLimit    int64
	allowedMimetypes []string
}

func setupDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	statement := `
			create table if not exists Users (ID text not null);
			create table if not exists Topics (
				ID integer not null primary key,
				UserID integer not null,
				Name text not null
			);
			create table if not exists Decks (
				ID integer not null primary key,
				TopicID integer not null,
				Name text not null
			);
			create table if not exists Flashcards (
				ID integer not null primary key,
				DeckID integer not null,
				Question text not null,
				Answer text not null
			);`
	_, err = db.Exec(statement)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func NewApp() (App, error) {
	db, err := setupDB("test.db")
	if err != nil {
		return App{}, err
	}

	app := App{
		db:               db,
		fileUploadLimit:  32 << 20, // 32 megabytes
		fileSizeLimit:    10 << 20, // 20 megabytes
		allowedMimetypes: []string{"image/png", "image/jpeg"},
	}

	// Load the secrets
	data, err := readFile("/run/secrets/jwt_secret")
	if err != nil {
		return App{}, err
	}
	app.jwtSecret = data

	data, err = readFile("/run/secrets/groq_api_key")
	if err != nil {
		return App{}, err
	}
	app.groqApiKey = string(data)

	return app, nil
}

// Write response json that either holds an error message or some custom data
func handleResponse(ctx *gin.Context, statusCode int, object any) {
	message := ""
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
	token, err := parseToken(tokenStr, app.jwtSecret)

	if err != nil {
		fmt.Println(err)
		return "", fmt.Errorf("Invalid JWT")
	}

	userId, err := token.Claims.GetSubject()
	if err != nil {
		return "", fmt.Errorf("JWT doesn't contain the user's id")
	}

	query, err := app.db.Prepare("select * from Users where ID = ?")
	rows, err := query.Query(userId)
	if !rows.Next() {
		return "", fmt.Errorf("User doesn't exist")
	}

	return userId, nil
}

// Create a user and respond with a json web token containing the user'd ID
func (app *App) CreateUser(ctx *gin.Context) {
	userId := uuid.NewString()

	statement, err := app.db.Prepare("insert into Users (ID) values (?);")
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	_, err = statement.Exec(userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	tokenStr, err := createToken(app.jwtSecret, userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]string{"token": tokenStr}
	handleResponse(ctx, http.StatusOK, response)
}

type CreateTopicData struct {
	Name string `json:"name" binding:"required"`
}

// TODO: ensure the topic hasn't been created before
// Create a new topic associated to the user. A topic
// contains notes and flashcard decks
func (app *App) CreateTopic(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	var data CreateTopicData
	if err := ctx.ShouldBindJSON(&data); err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	sqlStr := "insert into Topics (UserID, Name) values (?, ?)"
	statement, err := app.db.Prepare(sqlStr)

	_, err = statement.Exec(userId, data.Name)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	handleResponse(ctx, http.StatusOK, nil)
}

type UploadNotesData struct {
	TopicId string `json:"topicId" binding:"required"`
}

// Upload files that'll serve as context for the LLM
// when it generates flashcards
func (app *App) UploadNotes(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	var data UploadNotesData
	if err := ctx.ShouldBindJSON(&data); err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	form, err := ctx.MultipartForm()
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	files, ok := form.File["file"]
	if !ok {
		handleResponse(ctx, http.StatusBadRequest, "No attached files")
		return
	}

	for _, file := range files {
		if file.Size > app.fileSizeLimit {
			msg := fmt.Sprintf("%s: too big", file.Filename)
			handleResponse(ctx, http.StatusBadRequest, msg)
			return
		}

		mimetype := file.Header.Get("Content-Type")
		if !slices.Contains(app.allowedMimetypes, mimetype) {
			msg := fmt.Sprintf("%s: invalid file type", file.Filename)
			handleResponse(ctx, http.StatusBadRequest, msg)
			return
		}

		path := filepath.Join(".", "images", userId, data.TopicId, file.Filename)
		ctx.SaveUploadedFile(file, path)
	}

	handleResponse(ctx, http.StatusOK, nil)
}

type CreateDeckData struct {
	TopicId    string `json:"topicId" binding:"required"`
	Name       string `json:"name" binding:"required"`
	UserPrompt string `json:"user_prompt" binding:"required"`
}

// TODO: test this (what am I missing??)
// TODO: make sure the topic we're refering to actually exists

// Create a new flashcard deck associated to a user's topic
// Use all the files associated to the topic as llm context
// Then prompt the llm using the prompt template and the
// additional user prompt. Then parse the flashcards and store
// them in the database. Then return a json response containing
// all the generated flashcards.
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

	statement, err := app.db.Prepare("insert into Decks (TopicID, Name) values (?, ?)")
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	result, err := statement.Exec(data.TopicId, data.Name)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	deckId, err := result.LastInsertId()
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	template, err := readFile("./create-flashcards.txt")
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}
	textPrompt := fmt.Sprintf("%s%s", template, data.UserPrompt)

	userFolder := filepath.Join(".", "images", userId, data.TopicId)
	responses, err := promptWithFileContext(
		userFolder, textPrompt, userId, app.groqApiKey,
	)

	// TODO: actually parse the llm's response to get all the flashcards

	sqlStr := "insert into Flashcards (DeckID, Question, Answer) values (?, ?, ?)"
	statement, err = app.db.Prepare(sqlStr)
	_, err = statement.Exec(deckId, "TODO!", responses[0])
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{
		"message":    "Create deck!",
		"flashcards": []string{responses[0]},
		"deckId":     deckId,
	}
	handleResponse(ctx, http.StatusOK, response)
}

func main() {
	app, err := NewApp()
	if err != nil {
		panic(err)
	}
	defer app.db.Close()

	gin.SetMode(gin.ReleaseMode)

	server := gin.Default()
	server.MaxMultipartMemory = 10 << 20 // 10 MB upload max

	server.POST("/createUser", app.CreateUser)
	server.POST("/uploadNotes", app.UploadNotes)
	server.POST("/createTopic", app.CreateTopic)
	server.POST("/createDeck", app.CreateDeck)
	//server.GET("/getUserData", app.GetUserData)

	fmt.Println("Serving the backend from port 8080")
	if err := server.Run(); err != nil {
		panic(err)
	}
}
