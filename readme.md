# Snapcram

Snapcram is a mobile app that lets you generate flashcards
based off of pictures of your notes.

Tech stack:
- Frontend: React native with tamagui
- Backend: Golang, sqlite, Groq api

### Building
Before running the app, you'll need to create 2 .env files.
One in the root directory of the project:
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

One in frontend/
```env
EXPO_PUBLIC_DEBUG_HOST_ADDRESS=<your computer's ip address>
EXPO_PUBLIC_SUPPORT_EMAIL=<same email address as before>
EXPO_PUBLIC_ENCRYPTION_KEY=<some 256 bit secret key>
```

Run the frontend: Note: you'll need Java 17 and Android Studio installed.
```bash
cd path/to/snapcram/frontend
npm install
npx expo run android
```

Run the backend:
```bash
cd path/to/snapcram/backend
sudo docker compose up
```