const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

function ownsConversation(id, userId) {
  return db.prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?").get(id, userId);
}

function makeTitle(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean;
}

// POST /api/image/generate — { conversationId?, prompt }
router.post("/generate", async (req, res) => {
  const { prompt } = req.body;
  let { conversationId } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Please describe the image you want." });
  }

  if (!conversationId) {
    const info = db
      .prepare("INSERT INTO conversations (user_id, title) VALUES (?, 'New chat')")
      .run(req.userId);
    conversationId = info.lastInsertRowid;
  } else if (!ownsConversation(conversationId, req.userId)) {
    return res.status(404).json({ error: "Chat not found." });
  }

  const countBefore = db
    .prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id = ?")
    .get(conversationId).n;

  db.prepare(
    "INSERT INTO messages (conversation_id, user_id, role, content, image_data) VALUES (?, ?, 'user', ?, NULL)"
  ).run(conversationId, req.userId, `🎨 ${prompt}`);

  if (countBefore === 0) {
    db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(makeTitle(prompt), conversationId);
  }

  try {
    // FLUX.1-schnell is built for speed — as few as 4 diffusion steps, so this comes back fast.
    const response = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt,
        width: 1024,
        height: 768,
        steps: 4,
        n: 1,
        response_format: "b64_json",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Together AI error:", data);
      return res.status(502).json({ error: "Image service error. Check your TOGETHER_API_KEY in backend/.env." });
    }

    const b64 = data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No image came back. Try a different prompt." });
    }

    const dataUrl = `data:image/png;base64,${b64}`;

    db.prepare(
      "INSERT INTO messages (conversation_id, user_id, role, content, image_data) VALUES (?, ?, 'assistant', ?, ?)"
    ).run(conversationId, req.userId, "Here's your generated image:", dataUrl);

    res.json({ image: dataUrl, conversationId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Something went wrong while generating the image." });
  }
});

module.exports = router;
