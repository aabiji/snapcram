package main

import (
	//"database/sql"
	"encoding/json"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/mattn/go-sqlite3"
	"net/http"
	//"os"
	"path/filepath"
	"slices"
	"time"
)

/*
TODO:
- createToken()
- validateToken()
- getUserId(token): return error if the userId not in db
- POST /createUser
- POST /createTopic
- POST /createDeck
- POST /generateFlashcards
- GET /getUserData
- add jwt secret to docker secrets
- read docker secret file
- call endpoints from frontend
*/

func test() {
	/*
		os.Remove("./test.db")

		db, err := sql.Open("sqlite3", "test.db")
		if err != nil {
			panic(err)
		}
		defer db.Close()

		rawSQL := `
			create table Users (ID integer not null primary key);
			create table Topics (
				ID integer not null primary key,
				UserID integer not null, Name text not null
			);
			create table Decks (
				ID integer not null primary key,
				SessionID integer not null, Name text not null
			);
			create table Flashcards (
				ID integer not null primary key,
				DeckID integer not null,
				Prompt text not null, Answer text not null
			);`
		_, err = db.Exec(rawSQL)
		if err != nil {
			panic(err)
		}
	*/
	/*
		"insert into Users (ID) values (?)"
		"select * from Users where ID = ?"

		"insert into Topics (ID, UserID, Name) values (?, ?, ?)"
		"select * from Topics where UserID = ?"

		"insert into Decks (ID, SessionID, Name) values (?, ?, ?)"
		"select * from Decks where SessionID = ?"

		"insert into Flashcards (ID, DeckID, Prompt, Answer) values (?, ?, ?, ?)"
		"select * from Flashcards where DeckID = ?"
	*/
}

func createToken(secret []byte, userId string, expiry time.Time) (string, error) {
	claims := jwt.MapClaims{"sub": userId, "exp": expiry}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	encoded, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}
	return encoded, nil
}

func parseToken(encodedToken string, secret []byte) (*jwt.Token, error) {
	token, err := jwt.ParseWithClaims(
		encodedToken,
		jwt.MapClaims{},
		func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return secret, nil
		},
	)

	if err != nil {
		return nil, err
	}

	if _, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return token, nil // valid token
	}
	return nil, fmt.Errorf("invalid token")
}

/*
TODO: upload images from the frontend
	  if there are attached files, convert to base64 (remove readFile function)
	  convert to base64 when reading files
	  research different anki prompts
	  can we force the model to a output formatted response
	  refactor
	  start designing frontend
*/

/*
	payload := Payload{
		Model: "meta-llama/llama-4-scout-17b-16e-instruct",
		UserId: "test-client",
		Messages: []Message{
			{
				Role: "user",
				Content: []Prompt{
					{
						Type: "text",
						Text: "What is the image?",
						ImageUrl: nil,
					},
					{
						Type: "image_url",
						Text: "",
						ImageUrl: &ImageUrl{
							Url: base64EncodeFile("moon.jpeg"),
						},
					},
				},
			},
		},
	}

	apiKey := os.Getenv("GROQ_API_KEY") // apiKey, err := readText("/run/secrets/groq_api_key")
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

func handleFileUpload(w http.ResponseWriter, req *http.Request) {
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

func handleRoot(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path != "/" {
		handleResponse(w, http.StatusNotFound, nil)
		return
	}

	response := map[string]string{"message": "hello world 123"}
	handleResponse(w, http.StatusOK, response)
}

func main() {
	/*
		http.HandleFunc("/", handleRoot)
		http.HandleFunc("/upload", handleFileUpload)
		fmt.Println("Serving the backend on port 8080")
		http.ListenAndServe(":8080", nil)
	*/

	// TODO: actually test this!
	fmt.Println("creating the token")
	secret := []byte("super secret!")
	encoded, err := createToken(secret, "123", time.Now().Add(time.Hour * 24 * 5))
	if err != nil {
		panic(err)
	}

	fmt.Println("parsing the token")
	token, err := parseToken(encoded, secret)
	if err != nil {
		panic(err)
	}

	fmt.Println(token.Claims.GetSubject())
}
