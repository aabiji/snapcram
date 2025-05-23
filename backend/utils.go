package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"math/rand/v2"
	"os"
	"strings"
	"time"
)

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

func createRandomFilename(userId, extension string) string {
	timestamp := time.Now().Unix()
	value := rand.IntN(1000)
	return fmt.Sprintf("%s-%d-%d%s", userId, timestamp, value, extension)
}

func loadSecrets(envFile string) (map[string]string, error) {
	file, err := os.ReadFile(envFile)
	if err != nil {
		return nil, err
	}

	values := map[string]string{}

	lines := strings.Split(string(file), "\n")
	for index, line := range lines {
		line := strings.Replace(line, " ", "", -1)

		parts := strings.Split(line, "=")
		if len(parts) != 2 {
			return nil, fmt.Errorf("error in %s on line %d", envFile, index+1)
		}
		values[parts[0]] = parts[1]
	}

	return values, nil
}
