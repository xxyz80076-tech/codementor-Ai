const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const db = require("../db");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password || !fullName.trim() || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: "Please enter your full name, email, and password." });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  // Email is the account identifier, keeping sign-up to the requested three fields.
  const cleanUsername = cleanEmail;
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists. Try logging in instead." });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail)) {
    return res.status(409).json({ error: "An account with this email already exists. Try logging in instead." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const info = db
    .prepare("INSERT INTO users (username, full_name, email, password_hash, auth_provider) VALUES (?, ?, ?, ?, 'local')")
    .run(cleanUsername, fullName.trim(), cleanEmail, passwordHash);

  const user = { id: info.lastInsertRowid, username: cleanUsername };
  res.json({ token: makeToken(user), username: user.username });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Please enter both a username and a password." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUsername);
  if (!user) {
    return res.status(404).json({ error: "No account found. Please sign up first." });
  }

  if (user.auth_provider === "google" || !user.password_hash) {
    return res.status(400).json({ error: "This account uses Google Sign-In. Please continue with Google instead." });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  res.json({ token: makeToken(user), username: user.username });
});

// POST /api/auth/google — { credential } is the ID token from Google's Sign-In button
router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential." });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload && payload.email;
    if (!email) {
      return res.status(400).json({ error: "Could not read an email from that Google account." });
    }

    const cleanUsername = email.trim().toLowerCase();
    let user = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUsername);

    if (!user) {
      const info = db
        .prepare("INSERT INTO users (username, email, password_hash, auth_provider) VALUES (?, ?, NULL, 'google')")
        .run(cleanUsername, cleanUsername);
      user = { id: info.lastInsertRowid, username: cleanUsername };
    }

    res.json({ token: makeToken(user), username: user.username });
  } catch (e) {
    console.error("Google sign-in error:", e);
    res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }
});

module.exports = router;
