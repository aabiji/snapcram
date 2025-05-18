package main

import (
	"database/sql"
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

	app.assetFolder = filepath.Join("..", "data", "images")

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

// Upload files that'll serve as context for the LLM
// when it generates flashcards
func (app *App) UploadFiles(ctx *gin.Context) {
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

		path := filepath.Join(app.assetFolder, userId, file.Filename)
		ctx.SaveUploadedFile(file, path)
	}

	handleResponse(ctx, http.StatusOK, nil)
}

type CreateDeckData struct {
	Name       string `json:"name" binding:"required"`
	UserPrompt string `json:"user_prompt" binding:"required"`
	NumCards   int    `json:"num_cards" binding:"required"`
}

type PromptTemplate struct {
	NumCards   int
	UserPrompt string
}

/*
Now comes the crux of the app -- creating decks.

3 step process (should split into multiple composable functions so it's more manageable):
- Upload the notes (image files) that user has selected

  When we upload files, each file gets tagged with an id.
  We should respond with a list of the file ids to the client.

  /uploadFiles -> {"files": ["fileid1", "fileid2", "fileid3"]}

  file ids could just be the names of the files on disk,
  that way we can verify if a file id is valid by just checking if
  the user has a file going by that name

  the file id could be: {user_id}-{unix timestamp}-{random number}.{file extension}
  (also means that the assets folder can be flat -- no subdirectories)

- Use the Groq api to prompt an llm that'll generate flashcards,
  using the previously uploaded files,
  and return the response in structured json:

  validate the userid and json payload

  readFromFileStore(fileId) -> os.File
  readAsBase64(os.File) -> base64 string

  then just create the payload using the structs

  promptGrokLLM(payload) -> list of possible responses

- Parse the json response, write the values into the database,
  and return a json response to the client

  json parse the first possible response, validate the json

  populateDatabase():
	start sql transaction
	insert a new row into the decks table
	insert new rows into the flashcards table

  format and return the json response

  /generateFlashcards, { "name": "", "user_prompt": "", "num_cards": 10, files: [...file ids] }
  -> { "cards": [{"front": "", "back": ""}, ...] }

So on the frontend side, after the user clicks "create deck":
show loading screen -- "uploading notes..." then "generating flashcards..." then "almost done..."
transition into the deck screen with the flashcards
*/

func (app *App) CreateDeck(ctx *gin.Context) {
	panic(fmt.Sprintf("TODO!"))
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
