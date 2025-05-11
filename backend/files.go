package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Read a file from a path
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

// Read a file from a path and return its contents encoded in base64
func base64EncodeFile(path string) (string, error) {
	bytes, err := readFile(path)
	if err != nil {
		return "", err
	}

	builder := &strings.Builder{}
	encoder := base64.NewEncoder(base64.StdEncoding, builder)
	encoder.Write(bytes)
	encoder.Close()

	mimetype := ""
	extension := filepath.Ext(path)
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
