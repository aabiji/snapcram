# Snapcram

Mobile app that allows you to generate flashcards and practice quizzes based off
of your notes (images, pdf, word documents, etc).

Tech stack:
- React Native + tamagui frontend
- Golang backend
- SQLite database
- Docker

TODO:
- film devlog
- polish the flashcards page
- polish the flashcard decks page
- refactor the createDeck component
- style the loading screens
- allow the model to add diagrams and images into the flashcards
- figure out how to upload unlimited images when prompting
- make docker use postgresql -- toggle sqlite and postgresql (dev vs production)
- add settings component -- new page
- add authentication page
- look into cloud storage
- revamp this readme
- ship and talk to them about getting a visa letter (let's see where that goes)
- export the flashcards to anki

Run the frontend:
```bash
cd path/to/snapcram/frontend
npm install
npx expo start
```

Run the backend
```bash
cd path/to/snapcram/backend
docker compose up --build --watch # enable hot reloading
# `docker compose down` to delete the container

# TODO: get a groq api key
```
