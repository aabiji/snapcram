package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

func loadSecrets(envFile string) (map[string]string, error) {
	file, err := os.ReadFile(envFile)
	if err != nil {
		return nil, err
	}

	values := map[string]string{}

	lines := strings.Split(string(file), "\n")
	for index, line := range lines {
		line := strings.Replace(line, " ", "", -1)

		parts := strings.Split(line, "=")
		if len(parts) != 2 {
			return nil, fmt.Errorf("error in %s on line %d", envFile, index+1)
		}
		values[parts[0]] = parts[1]
	}

	return values, nil
}

type App struct {
	db               *sql.DB
	storage          CloudStorage
	fileUploadLimit  int64
	fileSizeLimit    int64
	allowedMimetypes []string
	secrets          map[string]string
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
			UserID text not null,
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

func NewApp(envFile string) (App, error) {
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

	secrets, err := loadSecrets(envFile)
	if err != nil {
		return App{}, err
	}
	app.secrets = secrets

	app.storage, err = NewCloudStorage(secrets, "snapcram", "us-east-005")
	if err != nil {
		return App{}, err
	}

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

	token, err := parseToken(tokenStr, []byte(app.secrets["JWT_SECRET"]))
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

	tokenStr, err := createToken([]byte(app.secrets["JWT_SECRET"]), userId)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]string{"token": tokenStr}
	handleResponse(ctx, http.StatusOK, response)
}

func createRandomFilename(userId, extension string) string {
	timestamp := time.Now().Unix()
	value := rand.IntN(1000)
	return fmt.Sprintf("%s-%d-%d%s", userId, timestamp, value, extension)
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

type Card struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

type Deck struct {
	Name  string `json:"name"`
	Cards []Card `json:"cards"`
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

// Read a file from a path and return its contents encoded in base64
func base64EncodeFile(file io.Reader, mimetype string) (string, error) {
	bytes, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	builder := &strings.Builder{}
	encoder := base64.NewEncoder(base64.StdEncoding, builder)
	encoder.Write(bytes)
	encoder.Close()

	formatted := fmt.Sprintf("data:%s;base64,%s", mimetype, builder.String())
	return formatted, nil
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

func (app *App) insertRecords(cards []Card, userId, deckName string) error {
	_, err := app.db.Exec("begin transaction;")
	if err != nil {
		return err
	}

	statement, err := app.db.Prepare("insert into Decks (UserId, Name) values (?, ?);")
	if err != nil {
		return err
	}

	result, err := statement.Exec(userId, deckName)
	if err != nil {
		return err
	}

	deckId, err := result.LastInsertId()
	if err != nil {
		return err
	}

	for _, card := range cards {
		str := "insert into Flashcards (DeckId, Front, Back) values (?, ?, ?);"
		statement, err = app.db.Prepare(str)
		if err != nil {
			return err
		}

		_, err = statement.Exec(deckId, card.Front, card.Back)
		if err != nil {
			return err
		}
	}

	_, err = app.db.Exec("commit;")
	return err
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

	err = app.insertRecords(cards, userId, data.Name)
	if err != nil {
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"name": data.Name, "cards": cards}
	handleResponse(ctx, http.StatusOK, response)
}

func (app *App) getUserDecks(userId string) ([]Deck, error) {
	deckQuery, err := app.db.Prepare("select ID, Name from Decks where UserID = ?")
	if err != nil {
		return nil, err
	}

	deckRows, err := deckQuery.Query(userId)
	if err != nil {
		return nil, err
	}
	defer deckRows.Close()

	decks := []Deck{}
	for deckRows.Next() {
		var deckId, deckName string
		if err := deckRows.Scan(&deckId, &deckName); err != nil {
			return nil, err
		}

		cardQuery, err :=
			app.db.Prepare("select Front, Back from Flashcards where DeckID = ?")
		if err != nil {
			return nil, err
		}

		cardRows, err := cardQuery.Query(deckId)
		if err != nil {
			return nil, err
		}

		cards := []Card{}
		for cardRows.Next() {
			var cardFront, cardBack string
			if err := cardRows.Scan(&cardFront, &cardBack); err != nil {
				cardRows.Close()
				return nil, err
			}
			cards = append(cards, Card{Front: cardFront, Back: cardBack})
		}

		cardRows.Close()
		decks = append(decks, Deck{Name: deckName, Cards: cards})
	}

	return decks, nil
}

// Response with all of the user's decks
func (app *App) GetUserInfo(ctx *gin.Context) {
	userId, err := app.getUserID(ctx)
	if err != nil {
		handleResponse(ctx, http.StatusBadRequest, "Authentication required")
		return
	}

	decks, err := app.getUserDecks(userId)
	if err != nil {
		fmt.Println(err)
		handleResponse(ctx, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]any{"decks": decks}
	handleResponse(ctx, http.StatusOK, response)
}

func main() {
	app, err := NewApp("../.env")
	if err != nil {
		panic(err)
	}
	defer app.db.Close()

	gin.SetMode(gin.DebugMode)
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
