package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"io"
	"net/http"
	"os"
)

/*
TODO: set up api endpoint to create flashcards
	  the api endpoint should allow image uploads
	  if there are attached files, convert to base64 (remove readFile function)
	  validate the images so that they fit the constraints that groq emposes
	  https://console.groq.com/docs/vision
	  research different anki prompts
	  can we force the model to a output formatted response
	  refactor
*/

/*
func rootEndpoint(w http.ResponseWriter, req *http.Request) {
	response := map[string]string{ "message": "hello world" }

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
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

func readText(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func main() {
	//http.HandleFunc("/", rootEndpoint)
	//http.ListenAndServe(":8080", nil)

	// base64 encode an image
	imageBytes, err := readFile("image.jpeg")
	if err != nil {
		panic(err)
	}

	base64Image := &strings.Builder{}
	encoder := base64.NewEncoder(base64.StdEncoding, base64Image)
	encoder.Write(imageBytes)
	encoder.Close()

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
