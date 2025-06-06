package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
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
	Model          string            `json:"model"`
	UserId         string            `json:"user"`
	Messages       []Message         `json:"messages"`
	Temperature    float32           `json:"temperature"`
	ResponseFormat map[string]string `json:"response_format"`
}

// Use the Groq api to prompt an LLM and return the json api response
func promptGroqLLM(payload Payload, apiKey string) (map[string]any, error) {
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
	if response.StatusCode == 413 {
		return nil, fmt.Errorf("payload is too large")
	}

	responseBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	var responseJson map[string]any
	err = json.Unmarshal(responseBytes, &responseJson)
	if err != nil {
		return nil, err
	}
	return responseJson, nil
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

// Create a a bunch of flashcard drafts from a batch of assets
func createFlashcardDrafts(
	apiKey string, userId string, files []*multipart.FileHeader,
) ([]Card, error) {
	// Create the request payload
	NumCards := len(files) * 10 // generate 10 flashcards per assets
	promptContent, err := parseTemplate(
		"templates/batch-prompt.template",
		struct{ NumCards int }{NumCards},
	)
	if err != nil {
		return nil, err
	}

	textPrompts := []Prompt{{Type: "text", Text: promptContent}}

	imagePrompts := []Prompt{}
	for _, file := range files {
		reader, err := file.Open()
		if err != nil {
			reader.Close()
			return nil, err
		}
		reader.Close()

		content, err := base64EncodeFile(reader, file.Header.Get("Content-Type"))
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
		Temperature:    0.8,
	}

	// Prompt the llm and get the cards
	response, err := promptGroqLLM(payload, apiKey)
	if err != nil {
		return nil, err
	}

	cards, err := extractCards(response)
	return cards, err
}

// Create a flashcard deck from a bunch of flashcard drafts
func createFlashcardDeck(
	apiKey string, userId string, drafts []Card, deckSize int,
) ([]Card, error) {
	// Create the request payload
	t := struct {
		DeckSize int
		Cards    []Card
	}{
		DeckSize: deckSize,
		Cards:    drafts,
	}
	promptContent, err := parseTemplate("templates/combine-prompt.template", t)
	if err != nil {
		return nil, err
	}

	payload := Payload{
		Model:  "meta-llama/llama-4-scout-17b-16e-instruct",
		UserId: userId,
		Messages: []Message{
			{Role: "user", Content: []Prompt{{Type: "text", Text: promptContent}}},
		},
		ResponseFormat: map[string]string{"type": "json_object"},
		Temperature:    0.8,
	}

	response, err := promptGroqLLM(payload, apiKey)
	if err != nil {
		return nil, err
	}

	cards, err := extractCards(response)
	return cards, nil
}
