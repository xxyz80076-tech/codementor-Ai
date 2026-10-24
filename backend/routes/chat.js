const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { SYSTEM_PROMPT } = require("../utils/systemPrompt");

const router = express.Router();
router.use(requireAuth);

// Gemini 2.0 Flash — fast, multimodal, and on Google's free tier
// Keep the model configurable so it can be upgraded without changing code.
// gemini-2.0-flash was retired by Google on June 1, 2026.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

function geminiErrorMessage(status, error) {
  const upstreamMessage = error?.error?.message || "";

  if (status === 400 || /API key not valid|invalid.*API key/i.test(upstreamMessage)) {
    return "Gemini rejected the API key. Create a Gemini API key in Google AI Studio, set GEMINI_API_KEY in backend/.env, then restart the backend.";
  }
  if (status === 401 || status === 403) {
    return "Gemini could not authorize this request. Check that GEMINI_API_KEY is a valid Google AI Studio key and that the Gemini API is enabled for it.";
  }
  if (status === 404) {
    return `The configured Gemini model (${GEMINI_MODEL}) is unavailable. Set GEMINI_MODEL in backend/.env to a model available to your API key, then restart the backend.`;
  }
  if (status === 429) {
    return "Gemini rate limit or quota reached. Wait a moment or check the quota for this API key in Google AI Studio.";
  }

  return "Gemini could not complete the request. Please try again shortly.";
}

function ownsConversation(id, userId) {
  return db.prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?").get(id, userId);
}

function makeTitle(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean;
}

// GET /api/chat/conversations — list this user's saved chats, newest first
router.get("/conversations", (req, res) => {
  const rows = db
    .prepare("SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY id DESC")
    .all(req.userId);
  res.json({ conversations: rows });
});

// POST /api/chat/conversations — explicitly create a new empty chat
router.post("/conversations", (req, res) => {
  const info = db
    .prepare("INSERT INTO conversations (user_id, title) VALUES (?, 'New chat')")
    .run(req.userId);
  res.json({ id: info.lastInsertRowid, title: "New chat" });
});

// DELETE /api/chat/conversations/:id
router.delete("/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!ownsConversation(id, req.userId)) {
    return res.status(404).json({ error: "Chat not found." });
  }
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  res.json({ ok: true });
});

// GET /api/chat/conversations/:id/messages
router.get("/conversations/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  if (!ownsConversation(id, req.userId)) {
    return res.status(404).json({ error: "Chat not found." });
  }
  const rows = db
    .prepare("SELECT id, role, content, image_data as image, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC")
    .all(id);
  res.json({ messages: rows });
});

// POST /api/chat/send — { conversationId?, text, image?: {dataUrl, mediaType}, lang? }
// Streams the reply back as raw text chunks (Content-Type: text/plain), powered by Gemini's
// free-tier streamGenerateContent endpoint.
router.post("/send", async (req, res) => {
  const { text, image, lang } = req.body;
  let { conversationId } = req.body;

  if (!text && !image) {
    return res.status(400).json({ error: "Message is empty." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: "Gemini is not configured. Set GEMINI_API_KEY in backend/.env to a Google AI Studio API key (it normally starts with AIza), then restart the backend.",
    });
  }

  if (!conversationId) {
    const info = db
      .prepare("INSERT INTO conversations (user_id, title) VALUES (?, 'New chat')")
      .run(req.userId);
    conversationId = info.lastInsertRowid;
  } else if (!ownsConversation(conversationId, req.userId)) {
    return res.status(404).json({ error: "Chat not found." });
  }

  const userText = text || "(sent a screenshot)";

  const countBefore = db
    .prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id = ?")
    .get(conversationId).n;

  db.prepare(
    "INSERT INTO messages (conversation_id, user_id, role, content, image_data) VALUES (?, ?, 'user', ?, ?)"
  ).run(conversationId, req.userId, userText, image ? image.dataUrl : null);

  if (countBefore === 0) {
    db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(makeTitle(userText), conversationId);
  }

  const history = db
    .prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC")
    .all(conversationId);

  const langNote =
    lang && lang !== "Auto-detect"
      ? `\n\n(The student specified this language: ${lang}. Prefer this unless it doesn't make sense for the request.)`
      : "";

  // Gemini's format: { role: "user"|"model", parts: [{ text }] }
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents[contents.length - 1].parts[0].text += langNote;

  if (image) {
    const base64 = image.dataUrl.split(",")[1];
    contents[contents.length - 1].parts.unshift({
      inline_data: { mime_type: image.mediaType, data: base64 },
    });
  }

  // set up the streaming response to the browser
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Conversation-Id", String(conversationId));
  res.setHeader("Access-Control-Expose-Headers", "X-Conversation-Id");
  if (res.flushHeaders) res.flushHeaders();

  let fullText = "";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      let errInfo = {};
      try { errInfo = await upstream.json(); } catch (e) { /* ignore */ }
      console.error("Gemini API error:", upstream.status, errInfo);
      res.write(geminiErrorMessage(upstream.status, errInfo));
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep the last (possibly incomplete) line for the next chunk

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const evt = JSON.parse(jsonStr);
          const delta = evt.candidates?.[0]?.content?.parts?.[0]?.text;
          if (delta) {
            fullText += delta;
            res.write(delta);
          }
        } catch (e) { /* skip malformed SSE line */ }
      }
    }

    if (!fullText) fullText = "Sorry, I didn't get a response. Please try again.";

    db.prepare(
      "INSERT INTO messages (conversation_id, user_id, role, content, image_data) VALUES (?, ?, 'assistant', ?, NULL)"
    ).run(conversationId, req.userId, fullText);

    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "Something went wrong while sending your request." });
    } else {
      res.write("\n\n[Connection error — please try again.]");
      res.end();
    }
  }
});

module.exports = router;


