package main

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

// Kiểm tra endpoint thật, không phụ thuộc shell/curl trong image backend.
func main() {
	if len(os.Args) != 2 {
		os.Exit(2)
	}
	client := http.Client{Timeout: 2 * time.Second}
	response, err := client.Get(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, response.Status)
		os.Exit(1)
	}
}
