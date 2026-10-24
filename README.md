# CodeMentor — Full Stack Project

An AI coding assistant for students (any language, any project). Real backend, real SQLite database, real login.

## What's inside
```
codementor-app/
  backend/     Node.js + Express + SQLite  (runs on http://localhost:5000)
  frontend/    React + Vite                (runs on http://localhost:5173)
```

## 1. Prerequisites
- Install **Node.js** (v18 or newer) from https://nodejs.org — this gives you `node` and `npm`.
- A code editor — VS Code is fine.
- An **Anthropic API key** — sign up at https://console.anthropic.com and create a key under "API Keys". This is required for the chat to work (it's what actually powers the AI replies). It's a paid API — check current pricing on that site.

## 2. Backend setup
Open a terminal in VS Code (`` Ctrl+` ``) and run:

```bash
cd backend
npm install
```

Now create your environment file:
```bash
cp .env.example .env
```
Open the new `.env` file and paste in your real Anthropic API key, and any random long string for `JWT_SECRET`.

Start the backend:
```bash
npm run dev
```
You should see: `CodeMentor backend running on http://localhost:5000`

This also automatically creates a `codementor.db` SQLite file in the `backend/` folder the first time it runs — that's your real database, with `users` and `messages` tables.

## 3. Frontend setup
Open a **second** terminal (keep the backend running in the first one):

```bash
cd frontend
npm install
npm run dev
```

You should see a local URL like `http://localhost:5173` — open that in your browser.

## 4. Using it
1. Sign up with any username/password (this creates a real row in the SQLite database).
2. Chat with CodeMentor — ask it to build something, paste an error, or attach a screenshot.
3. Log out and log back in — your chat history loads from the database.

## Notes
- Passwords are hashed with bcrypt before being stored — never saved as plain text.
- Login uses JWT tokens, stored in the browser's localStorage, valid for 30 days.
- To view your database directly, install the free "SQLite Viewer" extension in VS Code and open `backend/codementor.db`.
- Everyone currently shares the same conversation thread per account (like the earlier prototype). If you want separate named chat threads per user later, that's a straightforward next step — just ask.
