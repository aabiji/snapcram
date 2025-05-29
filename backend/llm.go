package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strings"
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

func parsePromptTemplate(path string, data any) (string, error) {
	t, err := template.ParseFiles(path)
	if err != nil {
		return "", err
	}

	output := &strings.Builder{}
	err = t.Execute(output, data)

	return output.String(), err
}

// This way, we can let the user parse the api response however they see fit
type ResponseHandler[R any] func(map[string]any) (R, error)

// TODO: when prompting the llm, sometimes it fails (500 - internal server error)
//       so it seems like there was an error when really there was none,
//       we should retry requests

// Use the Groq api to prompt an LLM and return the potential LLM outputs
func promptGroqLLM[R any](payload Payload, apiKey string, F ResponseHandler[R]) (R, error) {
	var zero R

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return zero, err
	}

	url := "https://api.groq.com/openai/v1/chat/completions"
	request, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return zero, err
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Add("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		return zero, err
	}
	defer response.Body.Close()

	responseBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return zero, err
	}

	var responseJson map[string]any
	err = json.Unmarshal(responseBytes, &responseJson)
	if err != nil {
		return zero, err
	}

	return F(responseJson)
}
