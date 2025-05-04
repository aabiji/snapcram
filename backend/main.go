package main

import (
	"encoding/json"
	"net/http"
)

func rootEndpoint(w http.ResponseWriter, req *http.Request) {
	response := map[string]string{ "message": "hello world" }

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	http.HandleFunc("/", rootEndpoint)
	http.ListenAndServe(":8080", nil)
}
