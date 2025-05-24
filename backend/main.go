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

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type App struct {
	db          Database
	storage     CloudStorage
	secrets     map[string]string
	inDebugMode bool
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
	storage.fileSizeLimit = 32 << 20 // 32 megabytes
	storage.allowedMimetypes = []string{"image/png", "image/jpeg"}

	return App{db, storage, secrets, inDebugMode}, nil
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

// Create a user and respond with a json web token containing the user'd ID
func (app *App) CreateUser(ctx *gin.Context) {
	userId := uuid.NewString()
	err := app.db.insertUser(userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

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
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	decks, err := app.db.getDecks(userId)
	if err != nil {
		fmt.Println(err)
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"decks": decks}
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
		if file.Size > app.storage.fileSizeLimit {
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

func (app *App) createPayload(data CreateDeckData, userId string) (*Payload, error) {
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

// Create a new flashcard deck. Use the supplied files and the additional user prompt
// and make an llm generate new flashcards (via the groq api). Return info
// on the newly created deck
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

	payload, err := app.createPayload(data, userId)
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
	server.MaxMultipartMemory = 10 << 20 // 10 MB upload max

	server.POST("/createUser", app.CreateUser)
	server.POST("/uploadFiles", app.UploadFiles)
	server.POST("/createDeck", app.CreateDeck)
	server.GET("/userInfo", app.GetUserInfo)
	if err := server.Run(); err != nil {
		panic(err)
	}
}
