# Snapcram

Snapcram is a mobile app that lets you generate flashcards
based off of pictures of your notes.

Tech stack:
- Frontend: React native with tamagui
- Backend: Golang, sqlite, Groq api

Run the frontend:
```bash
# Install android studio
sudo snap install android-studio # run through the default installation
sudo apt install openjdk-17-jdk # install java

cd path/to/snapcram/frontend
npm install
npx expo start
```

Run the backend
```bash
cd path/to/snapcram/backend
sudo docker compose up --build
```

Before running the backend, you'll also need to create a .env in the project root that looks something like this:
```env
DEBUG_MODE=1
GMAIL_ADDRESS=<the business email>
GMAIL_APP_PASSWORD=<Password you got from creating an app password here: https://myaccount.google.com/apppasswords>
GROQ_API_KEY=<your api key>
JWT_SECRET=<generate a secret key using this: https://jwtsecret.com/generate>

PGUSER=postgres
POSTGRES_DB=<what you want to call the database>
POSTGRES_PASSWORD=<super secret database password!>
DATABASE_URL=postgresql://<PGUSER>:<POSTGRES_PASSWORD>@db:5432/<POSTGRES_DB>
```
