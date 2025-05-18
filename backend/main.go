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
	allowedMimetypes []string
}

func setupDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	statement := `
		create table if not exists Users (ID text not null);
		create table if not exists Decks (
			ID integer not null primary key,
			Name text not null
		);
		create table if not exists Flashcards (
			ID integer not null primary key,
			DeckID integer not null,
			Front text not null,
			Back text not null
		);`
	_, err = db.Exec(statement)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func NewApp(baseSecretsPath string) (App, error) {
	db, err := setupDB(filepath.Join("..", "data", "database.db"))
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
	data, err := os.ReadFile(path)
	if err != nil {
		return App{}, err
	}
	app.jwtSecret = data

	path = filepath.Join(baseSecretsPath, "groq_api_key")
	data, err = os.ReadFile(path)
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
	if tokenStr[0] == '"' { // Remove quotes if present
		tokenStr = tokenStr[1 : len(tokenStr)-1]
	}

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

	statement, err := app.db.Prepare("insert into Users (ID) values (?)")
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

// Upload files and respond with a list of corresponding file ids
func (app *App) UploadFiles(ctx *gin.Context) {
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

		extension := filepath.Ext(file.Filename)
		filename := createRandomFilename(userId, extension)
		fileIds = append(fileIds, filename)

		osFile, err := file.Open()
		if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}
		defer osFile.Close()

		err = writeFileStore(osFile, filename)
		if err != nil {
			handleResponse(ctx, http.StatusInternalServerError, nil)
			return
		}
	}

	response := map[string]any{
		"files":  fileIds,
		"sucess": true,
	}
	handleResponse(ctx, http.StatusOK, response)
}

type CreateDeckData struct {
	Name       string   `json:"name" binding:"required"`
	UserPrompt string   `json:"userPrompt"`
	NumCards   int      `json:"numCards" binding:"required"`
	FilesIds   []string `json:"fileIds" binding:"required"`
}

type PromptTemplate struct {
	NumCards   int
	UserPrompt string
}

type Card struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

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

func createPayload(data CreateDeckData, userId string) (*Payload, error) {
	templateData := PromptTemplate{
		NumCards: data.NumCards, UserPrompt: data.UserPrompt,
	}
	promptContent, err := parsePromptTemplate("prompt.template", templateData)
	if err != nil {
		return nil, err
	}

	textPrompts := []Prompt{{Type: "text", Text: promptContent}}

	imagePrompts := []Prompt{}
	for _, id := range data.FilesIds {
		file, err := readFileStore(id)
		if err != nil {
			return nil, err
		}
		defer file.Close()

		content, err := readBase64(file)
		if err != nil {
			return nil, err
		}

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
	}
	return &payload, nil
}

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

	if len(data.FilesIds) == 0 {
		handleResponse(ctx, http.StatusBadRequest, "No files were provided")
		return
	}

	payload, err := createPayload(data, userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	cards, err := promptGroqLLM(*payload, app.groqApiKey, extractCards)
	if err != nil {
		fmt.Println(err)
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	// TODO: now insert into the database during a transaction
	// TODO: respond with json to the client

	for _, card := range cards {
		fmt.Println(card.Front)
		fmt.Println(card.Back)
	}
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
	server.POST("/uploadFiles", app.UploadFiles)
	server.POST("/createDeck", app.CreateDeck)

	if err := server.Run(); err != nil {
		panic(err)
	}
}
