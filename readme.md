# Snapcram

Snapcram is a mobile app that lets you generate flashcards
based off of pictures of your notes/

Tech stack:
- Frontend: React native with tamagui
- Backend: Golang, sqlite, Groq api

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
