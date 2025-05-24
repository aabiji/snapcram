package main

import "database/sql"

// TODO: port database driver to pgx

type Card struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

type Deck struct {
	Name  string `json:"name"`
	Cards []Card `json:"cards"`
}

type Database struct {
	ptr *sql.DB
}

func NewDatabase(path string) (Database, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return Database{}, err
	}

	// Setup the tables
	statement := `
		create table if not exists Users (ID text not null);
		create table if not exists Decks (
			ID integer not null primary key,
			UserID text not null,
			Name text not null
		);
		create table if not exists Flashcards (
			ID integer not null primary key,
			DeckID integer not null,
			Front text not null,
			Back text not null
		);`
	_, err = db.Exec(statement)
	if err != nil {
		return Database{}, err
	}

	return Database{db}, nil
}

func (db *Database) Close() { db.ptr.Close() }

func (db *Database) rowExists(query string, values ...any) (bool, error) {
	statement, err := db.ptr.Prepare(query)
	if err != nil {
		return false, err
	}

	rows, err := statement.Query(values...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	return rows.Next(), nil
}

func (db *Database) insertUser(userId string) error {
	statement, err := db.ptr.Prepare("insert into Users (ID) values (?)")
	if err != nil {
		return err
	}

	_, err = statement.Exec(userId)
	return err
}

func (db *Database) userExists(userId string) (bool, error) {
	exists, err := db.rowExists("select * from Users where ID = ?", userId)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (db *Database) insertDeck(userId string, deck Deck) error {
	_, err := db.ptr.Exec("begin transaction;")
	if err != nil {
		return err
	}

	statement, err := db.ptr.Prepare("insert into Decks (UserId, Name) values (?, ?);")
	if err != nil {
		return err
	}

	result, err := statement.Exec(userId, deck.Name)
	if err != nil {
		return err
	}

	deckId, err := result.LastInsertId()
	if err != nil {
		return err
	}

	for _, card := range deck.Cards {
		str := "insert into Flashcards (DeckId, Front, Back) values (?, ?, ?);"
		statement, err = db.ptr.Prepare(str)
		if err != nil {
			return err
		}

		_, err = statement.Exec(deckId, card.Front, card.Back)
		if err != nil {
			return err
		}
	}

	_, err = db.ptr.Exec("commit;")
	return err
}

func (db *Database) getFlashcards(deckId string) ([]Card, error) {
	query, err := db.ptr.Prepare("select Front, Back from Flashcards where DeckID = ?")
	if err != nil {
		return nil, err
	}

	rows, err := query.Query(deckId)
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
	query, err := db.ptr.Prepare("select ID, Name from Decks where UserID = ?")
	if err != nil {
		return nil, err
	}

	rows, err := query.Query(userId)
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
