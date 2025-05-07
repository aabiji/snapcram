package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type ImageUrl struct {
	Url string `json:"url"`
}

// Note:
// Can only have a maximum of 5 images per request
// Base64 image data should be <= 4 MB
// Images should have a 33 megapixel resolution limit
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

// Use the Groq api to prompt an LLM and return the potential LLM outputs
func promptGroqLLM(payload Payload, apiKey string) ([]string, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := "https://api.groq.com/openai/v1/chat/completions"
	request, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Add("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	responseBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	var responseJson map[string]any
	err = json.Unmarshal(responseBytes, &responseJson)
	if err != nil {
		return nil, err
	}

	choices, _ := responseJson["choices"].([]any)
	potentialResponses := []string{}

	for _, option := range choices {
		choice, _ := option.(map[string]any)
		message, _ := choice["message"].(map[string]any)
		content := message["content"].(string)
		potentialResponses = append(potentialResponses, content)
	}

	return potentialResponses, nil
}
