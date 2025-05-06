package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

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
TONIGHT:
	refactor file reading/writing into files.go	
	have a promptLLM() function
	validate the images so that they fit the constraints that groq emposes
	https://console.groq.com/docs/vision
	integrate with sqlite db (just get a basic demo working)
*/

type ImageUrl struct {
	Url string `json:"url"`
}

type Prompt struct {
	Type		string		`json:"type,omitempty"`
	Text		string		`json:"text,omitempty"`
	ImageUrl	*ImageUrl	`json:"image_url,omitempty"`
}

type Message struct {
	Role		string		`json:"role"`
	Content		[]Prompt	`json:"content"`
}

type Payload struct {
	Model		string		`json:"model"`
	UserId		string		`json:"user"`
	Messages	[]Message	`json:"messages"`
}

func readFile(path string) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return nil, err
	}
	fileSize := fileInfo.Size()

	buffer := make([]byte, fileSize)
	_, err = file.Read(buffer)
	if err != nil {
		return nil, err
	}

	return buffer, nil
}

func demo() {
	// base64 encode an image
	imageBytes, err := readFile("image.jpeg")
	if err != nil {
		panic(err)
	}

	// TODO: should have readBase64 in files.go
	base64Image := &strings.Builder{}
	encoder := base64.NewEncoder(base64.StdEncoding, base64Image)
	encoder.Write(imageBytes)
	encoder.Close()

	// TODO: set the actual file mimetype
	imageStr := fmt.Sprintf("data:image/jpeg;base64,%s", base64Image.String())

	prompt := "What is the image?"
	modelName := "meta-llama/llama-4-scout-17b-16e-instruct"
	payload := Payload{
		Model: modelName,
		UserId: "test-client",
		Messages: []Message{
			{
				Role: "user",
				Content: []Prompt{
					{
						Type: "text",
						Text: prompt,
						ImageUrl: nil,	
					},
					{
						Type: "image_url",
						Text: "",
						ImageUrl: &ImageUrl{
							Url: imageStr,
						},
					},
				},
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	url := "https://api.groq.com/openai/v1/chat/completions"
	request, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		panic(err)
	}

	request.Header.Set("Content-Type", "application/json")

	apiKey := os.Getenv("GROQ_API_KEY") // apiKey, err := readText("/run/secrets/groq_api_key")
	if len(apiKey) == 0 {
		panic("NO API KEY!?")
	}
	request.Header.Add("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		panic(err)
	}
	defer response.Body.Close()

	responseBytes, err := io.ReadAll(response.Body)
	if err != nil {
		panic(err)
	}

	var responseJson map[string]any
	err = json.Unmarshal(responseBytes, &responseJson)
	if err != nil {
		panic(err)
	}

	potentialResponses := []string{}

	choices, _ := responseJson["choices"].([]any)
	for _, option := range choices {
		choice, _ := option.(map[string]any)
		message, _ := choice["message"].(map[string]any)
		content := message["content"].(string)
		potentialResponses = append(potentialResponses, content)
	}

	fmt.Println("LLama says: ")
	for _, r := range potentialResponses {
		fmt.Println(r)
	}
}

func writeFile(path string, data []byte) error {
	folder := filepath.Dir(path)
	if folder != "." {
		os.MkdirAll(folder, 0644)
	}
	return os.WriteFile(path, data, 0644)
}

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

func handleRoot(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path != "/" {
		handleResponse(w, http.StatusNotFound, nil)
		return
	}

	response := map[string]string{ "message": "hello world 123" }
	handleResponse(w, http.StatusOK, response)
}

func handleFileUpload(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path != "/upload" {
		handleResponse(w, http.StatusNotFound, nil)
		return
	}

	var memoryCapacity int64 = 32 << 20 // 32 megabytes
	var fileSizeLimit int64 = 10 << 20 // 10 megabytes
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

func main() {
	http.HandleFunc("/", handleRoot)
	http.HandleFunc("/upload", handleFileUpload)
	fmt.Println("Serving the backend on port 8080")
	http.ListenAndServe(":8080", nil)
}
