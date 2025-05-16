package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type App struct {
	db               *sql.DB
	jwtSecret        []byte
	groqApiKey       string
	fileUploadLimit  int64
	fileSizeLimit    int64
	assetFolder      string
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
				UserID text not null,
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

func NewApp(baseSecretsPath string) (App, error) {
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
	path := filepath.Join(baseSecretsPath, "jwt_secret")
	data, err := readFile(path)
	if err != nil {
		return App{}, err
	}
	app.jwtSecret = data

	path = filepath.Join(baseSecretsPath, "groq_api_key")
	data, err = readFile(path)
	if err != nil {
		return App{}, err
	}
	app.groqApiKey = string(data)

	app.assetFolder = filepath.Join("..", "secrets", "images")

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

func (app *App) rowExists(query string, values ...any) (bool, error) {
	statement, err := app.db.Prepare(query)
	if err != nil {
		return false, err
	}

	rows, err := statement.Query(values...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	return rows.Next(), nil
}

// Extract the user'd ID from the request header and
// ensure the user exists, then return it
func (app *App) getUserID(ctx *gin.Context) (string, error) {
	tokenStr := ctx.GetHeader("Authorization")
	token, err := parseToken(tokenStr, app.jwtSecret)

	if err != nil {
		return "", fmt.Errorf("invalid json web token")
	}

	userId, err := token.Claims.GetSubject()
	if err != nil {
		return "", fmt.Errorf("json web token doesn't contain the user's id")
	}

	exists, err := app.rowExists("select * from Users where ID = ?", userId)
	if err != nil {
		return "", err
	}

	if !exists {
		return "", fmt.Errorf("user not found")
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

	// Ensure that the topic hasn't already been created
	exists, err :=
		app.rowExists("select * from Topics where UserID=? and Name=?", userId, data.Name)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	if exists {
		handleResponse(ctx, http.StatusNotAcceptable, "Topic has already been created")
		return
	}

	// Insert a new row into the database
	sqlStr := "insert into Topics (UserID, Name) values (?, ?)"
	statement, err := app.db.Prepare(sqlStr)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	result, err := statement.Exec(userId, data.Name)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	topicId, err := result.LastInsertId()
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	handleResponse(ctx, http.StatusOK, gin.H{"topicId": topicId})
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

	form, err := ctx.MultipartForm()
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	// Parse the json payload that was sent along with the multipart form
	var data UploadNotesData
	attachments, ok := form.Value["payload"]
	if !ok {
		handleResponse(ctx, http.StatusBadRequest, "No attached json payload")
		return
	}

	err = json.Unmarshal([]byte(attachments[0]), &data)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, nil)
		return
	}

	// Ensure the topic actually exists
	exists, err :=
		app.rowExists("select * from Topics where ID=?", data.TopicId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	if !exists {
		handleResponse(ctx, http.StatusNotAcceptable, "Topic not found")
		return
	}

	// Download the files
	files, ok := form.File["files"]
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

		path := filepath.Join(app.assetFolder, userId, data.TopicId, file.Filename)
		ctx.SaveUploadedFile(file, path)
	}

	handleResponse(ctx, http.StatusOK, nil)
}

type CreateDeckData struct {
	TopicId    string `json:"topicId" binding:"required"`
	Name       string `json:"name" binding:"required"`
	UserPrompt string `json:"user_prompt" binding:"required"`
	NumCards   int    `json:"num_cards" binding:"required"`
}

type PromptTemplate struct {
	NumCards   int
	UserPrompt string
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

	/*
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
	*/

	prompt, err := parsePromptTemplate("prompt.template", PromptTemplate{
		NumCards: data.NumCards, UserPrompt: data.UserPrompt,
	})
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	userFolder := filepath.Join(app.assetFolder, userId, data.TopicId)
	responses, err := promptWithFileContext(
		userFolder, prompt, userId, app.groqApiKey,
	)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}
	for _, r := range responses {
		fmt.Println(r)
	}

	/*
		// TODO: actually parse the llm's response to get all the flashcards

		sqlStr := "insert into Flashcards (DeckID, Question, Answer) values (?, ?, ?)"
		statement, err = app.db.Prepare(sqlStr)
		if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}

		_, err = statement.Exec(deckId, "TODO!", responses[0])
		if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}
	*/

	response := map[string]any{
		"message": "Success!",
		//"flashcards": []string{responses[0]},
		//"deckId": deckId,
	}
	handleResponse(ctx, http.StatusOK, response)
}

// Parse a command line flag to determine if the program
// should be ran in debug or release mode
func isReleaseMode() (bool, error) {
	msg := "--releaseMode=Debug or --releaseMode=Release is required"

	args := os.Args[1:]
	if len(args) == 0 {
		return false, errors.New(msg)
	}

	parts := strings.Split(args[0], "=")
	if len(parts) == 1 {
		return false, errors.New(msg)
	}

	return parts[1] == "Release", nil
}

func main() {
	release, err := isReleaseMode()
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	secretsPath := "/run/secrets" // Docker secrets path
	if !release {
		secretsPath = "../secrets"
	}

	app, err := NewApp(secretsPath)
	if err != nil {
		panic(err)
	}
	defer app.db.Close()

	if release {
		gin.SetMode(gin.ReleaseMode)
		fmt.Println("Serving the backend from port 8080 in release mode")
	} else {
		gin.SetMode(gin.DebugMode)
	}

	server := gin.Default()
	server.MaxMultipartMemory = 10 << 20 // 10 MB upload max

	server.POST("/createUser", app.CreateUser)
	server.POST("/uploadNotes", app.UploadNotes)
	server.POST("/createTopic", app.CreateTopic)
	server.POST("/createDeck", app.CreateDeck)
	//server.GET("/getUserData", app.GetUserData)

	if err := server.Run(); err != nil {
		panic(err)
	}
}
