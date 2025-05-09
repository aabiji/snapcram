package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"net/http"
	"path/filepath"
	"slices"
)

/*
TODO:
- implement the frontend
- read secretes from docker secret files
- POST /createTopic
- POST /createDeck
- POST /generateFlashcards
- GET /getUserData
- call endpoints from frontend
*/

/*
	"insert into Users (ID) values (?)"

	"insert into Topics (ID, UserID, Name) values (?, ?, ?)"
	"select * from Topics where UserID = ?"

	"insert into Decks (ID, SessionID, Name) values (?, ?, ?)"
	"select * from Decks where SessionID = ?"

	"insert into Flashcards (ID, DeckID, Prompt, Answer) values (?, ?, ?, ?)"
	"select * from Flashcards where DeckID = ?"
*/

func handleResponse(w http.ResponseWriter, statusCode int, object any) {
	w.WriteHeader(statusCode)
	w.Header().Set("Content-Type", "application/json")

	message := ""
	if statusCode == http.StatusNotFound {
		message = "Page not found!"
	} else if statusCode == http.StatusInternalServerError {
		message = "Internal server error"
	} else if statusCode == http.StatusBadRequest {
		message = "Invalid request"
	}

	if statusCode != http.StatusOK {
		response := map[string]any{
			"error": message, "details": object,
		}
		json.NewEncoder(w).Encode(response)
	} else {
		json.NewEncoder(w).Encode(object)
	}
}

type App struct {
	db        *sql.DB
	jwtSecret []byte
}

// Wrap our method into a HandlerFunc so that we can the
// handler function can access 'app'
func (app *App) wrapHandler(
	method string,
	fn func(w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if len(method) > 0 && r.Method != method {
			handleResponse(w, http.StatusNotFound, "")
			return
		}
		fn(w, r)
	}
}

func (app *App) getUserId(req *http.Request) (string, error) {
	tokenStr := req.Header.Get("Authorization")
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

func (app *App) handleFileUpload(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path != "/upload" {
		handleResponse(w, http.StatusNotFound, nil)
		return
	}

	var memoryCapacity int64 = 32 << 20 // 32 megabytes
	var fileSizeLimit int64 = 10 << 20  // 10 megabytes
	allowedMimetypes := []string{"image/png", "image/jpeg"}

	err := req.ParseMultipartForm(memoryCapacity)
	if err != nil {
		handleResponse(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	fileHeaders, ok := req.MultipartForm.File["file"]
	if !ok || len(fileHeaders) == 0 {
		handleResponse(w, http.StatusBadRequest, "No attached files")
		return
	}

	for _, header := range fileHeaders {
		if header.Size > fileSizeLimit {
			msg := fmt.Sprintf("%s: too big", header.Filename)
			handleResponse(w, http.StatusBadRequest, msg)
			return
		}

		mimetype := header.Header.Get("Content-Type")
		if !slices.Contains(allowedMimetypes, mimetype) {
			msg := fmt.Sprintf("%s: invalid file type", header.Filename)
			handleResponse(w, http.StatusBadRequest, msg)
			return
		}

		file, err := header.Open()
		if err != nil {
			handleResponse(w, http.StatusInternalServerError, nil)
			return
		}

		buffer := make([]byte, header.Size)
		if _, err := file.Read(buffer); err != nil {
			handleResponse(w, http.StatusInternalServerError, nil)
			return
		}
		file.Close()

		path := filepath.Join(".", "images", header.Filename)
		if err := writeFile(path, buffer); err != nil {
			handleResponse(w, http.StatusInternalServerError, nil)
			return
		}
	}

	response := map[string]string{"message": "Files uploaded successfully!"}
	handleResponse(w, http.StatusOK, response)
}

func (app *App) handle404(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path != "/" || req.Method != "GET" {
		handleResponse(w, http.StatusNotFound, nil)
		return
	}

	response := map[string]string{"message": "hello world 123"}
	handleResponse(w, http.StatusOK, response)
}

func (app *App) createUser(w http.ResponseWriter, req *http.Request) {
	userId := uuid.NewString()

	statement, err := app.db.Prepare("insert into Users (ID) values (?);")
	if err != nil {
		handleResponse(w, http.StatusInternalServerError, nil)
		return
	}

	_, err = statement.Exec(userId)
	if err != nil {
		handleResponse(w, http.StatusInternalServerError, nil)
		return
	}

	tokenStr, err := createToken(app.jwtSecret, userId, DEFAULT_EXPIRY)
	if err != nil {
		handleResponse(w, http.StatusInternalServerError, nil)
		return
	}

	response := map[string]string{"token": tokenStr}
	handleResponse(w, http.StatusOK, response)
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
				UserID integer not null, Name text not null
			);
			create table if not exists Decks (
				ID integer not null primary key,
				SessionID integer not null, Name text not null
			);
			create table if not exists Flashcards (
				ID integer not null primary key,
				DeckID integer not null,
				Prompt text not null, Answer text not null
			);`
	_, err = db.Exec(statement)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func main() {
	db, err := setupDB("test.db")
	if err != nil {
		panic(err)
	}
	defer db.Close()
	app := App{db: db, jwtSecret: []byte("super duper secret!")}

	mux := http.NewServeMux()
	mux.HandleFunc("/create-user", app.wrapHandler("POST", app.createUser))
	mux.HandleFunc("/upload", app.wrapHandler("POST", app.handleFileUpload))
	mux.HandleFunc("/", app.wrapHandler("", app.handle404))

	fmt.Println("Listening on port :8080")
	http.ListenAndServe(":8080", mux)
}
