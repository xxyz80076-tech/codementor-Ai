require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const imageRoutes = require("./routes/image");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // higher limit so screenshots fit

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/image", imageRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY is not set in backend/.env — chat requests will fail until you add it.");
}
if (!process.env.TOGETHER_API_KEY) {
  console.warn("⚠️  TOGETHER_API_KEY is not set in backend/.env — image generation will fail until you add it.");
}

app.listen(PORT, () => {
  console.log(`CodeMentor backend running on http://localhost:${PORT}`);
});
