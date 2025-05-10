package main

import (
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"time"
)

func createToken(secret []byte, userId string) (string, error) {
	expiry := time.Now().Add(time.Hour * 24 * 100).Unix() // Expires in 100 days
	claims := jwt.MapClaims{"sub": userId, "exp": expiry}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	encoded, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}
	return encoded, nil
}

func parseToken(encodedToken string, secret []byte) (*jwt.Token, error) {
	token, err := jwt.ParseWithClaims(
		encodedToken,
		jwt.MapClaims{},
		func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return secret, nil
		},
	)

	if err != nil {
		return nil, err
	}

	if _, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return token, nil // valid token
	}
	return nil, fmt.Errorf("invalid token")
}
