package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func createRandomFilename(userId, extension string) string {
	timestamp := time.Now().Unix()
	value := rand.IntN(1000)
	return fmt.Sprintf("%s-%d-%d.%s", userId, timestamp, value, extension)
}

func readFileStore(filename string) (*os.File, error) {
	path := filepath.Join("..", "data", filename)
	file, err := os.Open(path)
	return file, err
}

func writeFileStore(file io.Reader, filename string) error {
	path := filepath.Join("..", "data", filename)

	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	return err
}

func readFileContents(file *os.File) ([]byte, error) {
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

// Read a file from a path and return its contents encoded in base64
func readBase64(file *os.File) (string, error) {
	bytes, err := readFileContents(file)
	if err != nil {
		return "", err
	}

	builder := &strings.Builder{}
	encoder := base64.NewEncoder(base64.StdEncoding, builder)
	encoder.Write(bytes)
	encoder.Close()

	mimetype := ""
	extension := filepath.Ext(file.Name())
	if extension == "png" {
		mimetype = "image/png"
	} else if extension == "jpg" || extension == "jpeg" {
		mimetype = "image/jpeg"
	} else {
		return "", errors.New("unsupported file type")
	}

	formatted := fmt.Sprintf("data:%s;base64,%s", mimetype, builder.String())
	return formatted, nil
}
