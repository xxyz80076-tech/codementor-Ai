const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "codementor.db"));
db.pragma("journal_mode = WAL");

// ---- schema (runs once, safe to re-run) ----
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    email TEXT,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT 'New chat',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,               -- 'user' or 'assistant'
    content TEXT NOT NULL,
    image_data TEXT,                  -- base64 screenshot, nullable
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migrate databases created before profile fields (or auth_provider / nullable
// password_hash) were added. Rebuilds the table in place if needed — no data is lost.
const userColumnsInfo = db.prepare("PRAGMA table_info(users)").all();
const userColumns = userColumnsInfo.map(c => c.name);
const passwordHashCol = userColumnsInfo.find(c => c.name === "password_hash");
const needsRebuild = !userColumns.includes("auth_provider") || (passwordHashCol && passwordHashCol.notnull === 1);

if (needsRebuild) {
  const hasFullName = userColumns.includes("full_name");
  const hasEmail = userColumns.includes("email");
  const hasAuthProvider = userColumns.includes("auth_provider");

  db.pragma("foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS users_new;");

  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT,
      email TEXT,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    INSERT INTO users_new (id, username, full_name, email, password_hash, auth_provider, created_at)
    SELECT id, username,
      ${hasFullName ? "full_name" : "NULL"},
      ${hasEmail ? "email" : "NULL"},
      password_hash,
      ${hasAuthProvider ? "auth_provider" : "'local'"},
      created_at
    FROM users;
  `);
  db.exec("DROP TABLE users;");
  db.exec("ALTER TABLE users_new RENAME TO users;");

  db.pragma("foreign_keys = ON");
}

db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL");

module.exports = db;
