package main

import (
	"encoding/base64"
	"fmt"
	"html/template"
	"io"
	"os"
	"strings"
)

func readEnvironmentVariables() map[string]string {
	values := map[string]string{}
	for _, value := range os.Environ() {
		pair := strings.SplitN(value, "=", 2)
		values[pair[0]] = pair[1]
	}
	return values
}

func parseTemplate(path string, data any) (string, error) {
	t, err := template.ParseFiles(path)
	if err != nil {
		return "", err
	}

	output := &strings.Builder{}
	err = t.Execute(output, data)

	return output.String(), err
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
