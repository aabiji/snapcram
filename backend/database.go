package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Card struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

type Deck struct {
	Name  string `json:"name"`
	Cards []Card `json:"cards"`
}

type Database struct{ pool *pgxpool.Pool }

func NewDatabase(url string) (Database, error) {
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return Database{}, err
	}

	// Setup the tables
	statement := `
		create table if not exists Users (
			ID text not null,
			Email text not null,
			Password text not null
		);
		create table if not exists Decks (
			ID serial not null primary key,
			UserID text not null,
			Name text not null
		);
		create table if not exists Flashcards (
			ID serial not null primary key,
			DeckID integer not null,
			Front text not null,
			Back text not null
		);`
	_, err = pool.Exec(context.Background(), statement)
	if err != nil {
		return Database{}, err
	}

	return Database{pool}, nil
}

func (db *Database) Close() { db.pool.Close() }

func (db *Database) insertUser(email, password, userId string) error {
	statement := "insert into Users (ID, Email, Password) values ($1, $2, $3)"
	_, err := db.pool.Exec(
		context.Background(), statement, userId, email, password)
	return err
}

func (db *Database) userExists(userId string) (bool, error) {
	sql := "select * from Users where ID = $1"
	rows, err := db.pool.Query(context.Background(), sql, userId)
	if err != nil {
		return false, err
	}

	exists := rows.Next()
	rows.Close()
	return exists, nil
}

// Check that the password is correct and points to an existing account
// then return the associated user id
var ErrUserNotFound error = fmt.Errorf("user with email not found")
var ErrWrongPassword error = fmt.Errorf("incorrect password")

func (db *Database) validateUserCredentials(email, password string) (string, error) {
	str := "select ID, Password from Users where Email = $1"
	row := db.pool.QueryRow(context.Background(), str, email)

	var userId, existingPassword string
	err := row.Scan(&userId, &existingPassword)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", ErrUserNotFound
		}
		return "", err
	}

	if password != existingPassword {
		return "", ErrWrongPassword
	}
	return userId, nil
}

func (db *Database) insertDeck(userId string, deck Deck) error {
	tx, err := db.pool.Begin(context.Background())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())

	var deckId int
	str := "insert into Decks (UserId, Name) values ($1, $2) returning ID;"
	err = tx.QueryRow(context.Background(), str, userId, deck.Name).Scan(&deckId)
	if err != nil {
		return err
	}

	for _, card := range deck.Cards {
		str := "insert into Flashcards (DeckId, Front, Back) values ($1, $2, $3);"
		_, err = tx.Exec(context.Background(), str, deckId, card.Front, card.Back)
		if err != nil {
			return err
		}
	}

	err = tx.Commit(context.Background())
	return err
}

func (db *Database) getFlashcards(deckId string) ([]Card, error) {
	str := "select Front, Back from Flashcards where DeckID = $1"
	rows, err := db.pool.Query(context.Background(), str, deckId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := []Card{}
	for rows.Next() {
		var cardFront, cardBack string
		if err := rows.Scan(&cardFront, &cardBack); err != nil {
			return nil, err
		}
		cards = append(cards, Card{Front: cardFront, Back: cardBack})
	}

	return cards, nil
}

func (db *Database) getDecks(userId string) ([]Deck, error) {
	str := "select ID, Name from Decks where UserID = $1"
	rows, err := db.pool.Query(context.Background(), str, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	decks := []Deck{}
	for rows.Next() {
		var deckId, deckName string
		if err := rows.Scan(&deckId, &deckName); err != nil {
			return nil, err
		}

		cards, err := db.getFlashcards(deckId)
		if err != nil {
			return nil, err
		}

		decks = append(decks, Deck{Name: deckName, Cards: cards})
	}

	return decks, nil
}
