# Snapcram

Mobile app that allows you to generate flashcards and practice quizzes based off
of your notes (images, pdf, word documents, etc).

Tech stack:
- React Native + tamagui frontend
- Golang backend
- SQLite database
- Docker

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
```
