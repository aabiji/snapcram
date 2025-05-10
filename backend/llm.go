package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

type ImageUrl struct {
	Url string `json:"url"`
}

type Prompt struct {
	Type  string    `json:"type,omitempty"`
	Text  string    `json:"text,omitempty"`
	Image *ImageUrl `json:"image_url,omitempty"`
}

type Message struct {
	Role    string   `json:"role"`
	Content []Prompt `json:"content"`
}

type Payload struct {
	Model    string    `json:"model"`
	UserId   string    `json:"user"`
	Messages []Message `json:"messages"`
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

// Use the Groq api to prompt an LLM using the file prompts
// and the text prompt and return the potential LLM outputs
func promptWithFileContext(assetFolder string, text string, userId string, apiKey string) ([]string, error) {

	// TODO: batch requests since there's a prompt limit
	// Can only have a maximum of 5 images per request
	// Base64 image data should be <= 4 MB
	// Images should have a 33 megapixel resolution limit

	// TODO: support general purpose file prompts --
	// set the base64 data mimetype based off the file's extension

	entries, err := os.ReadDir(assetFolder)
	if err != nil {
		return nil, err
	}

	// Use each file in the folder as an image prompt
	imagePrompts := []Prompt{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			return nil, err
		}

		path := filepath.Join(assetFolder, info.Name())
		base64, err := base64EncodeFile(path)
		if err != nil {
			return nil, err
		}

		imagePrompts = append(imagePrompts, Prompt{
			Type: "image_url", Image: &ImageUrl{Url: base64},
		})
	}

	textPrompt := Prompt{Type: "Text", Text: text}

	payload := Payload{
		Model:  "meta-llama/llama-4-scout-17b-16e-instruct",
		UserId: userId,
		Messages: []Message{
			{Role: "user", Content: imagePrompts},
			{Role: "user", Content: []Prompt{textPrompt}},
		},
	}

	responses, err := promptGroqLLM(payload, apiKey)
	return responses, err
}
