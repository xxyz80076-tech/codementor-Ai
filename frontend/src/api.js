const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "") + "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// Streams the AI reply chunk-by-chunk, calling onChunk(text) as each piece arrives.
// Returns { conversationId } once the stream finishes.
async function sendStream(token, payload, onChunk) {
  const res = await fetch(BASE + "/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Something went wrong.";
    try { const data = await res.json(); msg = data.error || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }

  const conversationIdHeader = res.headers.get("X-Conversation-Id");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }

  return { conversationId: conversationIdHeader ? Number(conversationIdHeader) : null };
}

export const api = {
  signup: (fullName, email, password) => request("/auth/signup", { method: "POST", body: { fullName, email, password } }),
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: { credential } }),

  listConversations: (token) => request("/chat/conversations", { token }),
  createConversation: (token) => request("/chat/conversations", { method: "POST", token }),
  deleteConversation: (token, id) => request(`/chat/conversations/${id}`, { method: "DELETE", token }),
  getMessages: (token, id) => request(`/chat/conversations/${id}/messages`, { token }),

  sendStream,
  generateImage: (token, payload) => request("/image/generate", { method: "POST", body: payload, token }),
};
