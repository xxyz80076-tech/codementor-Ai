import React, { useState, useRef, useEffect } from "react";
import MessageContent from "./MessageContent";
import { api } from "../api";

const LANGS = [
  "Auto-detect", "Python", "Java", "C", "C++", "C#", "JavaScript", "TypeScript",
  "PHP", "Swift", "Kotlin", "Go", "Rust", "SQL", "HTML/CSS", "R", "Ruby"
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(raw) {
  try {
    const d = raw instanceof Date ? raw : new Date(String(raw).replace(" ", "T") + "Z");
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) { return ""; }
}

const WELCOME = {
  id: "welcome", role: "assistant", time: new Date(),
  text: "Hey! I'm CodeMentor 👋 Need code generated in any language, an error fixed, or a concept explained — just type it here. You can also send a screenshot of your code, I'll read and analyze it directly.\n\nExamples:\n- \"Write bubble sort in Java\"\n- Paste your error or send a screenshot\n- \"Explain recursion to me\""
};

const STARTERS = [
  { label: "🌐 I need a website built", text: "I need a website built." },
  { label: "🐞 Fix an error", text: "My code is throwing an error, please fix it:\n\n" },
  { label: "⚙️ Build a full project", text: "I need a full project built." },
  { label: "📖 Explain a concept", text: "Explain this concept to me: " },
];

const QUICK_ACTIONS = [
  { icon: "📄", label: "Explain Code", text: "Please explain this code:\n\n" },
  { icon: "🐞", label: "Debug Error", text: "I'm getting this error, please help fix it:\n\n" },
  { icon: "⌨️", label: "Generate Code", text: "Generate code for: " },
  { icon: "✨", label: "Improve Code", text: "Please review and improve this code:\n\n" },
  { icon: "💡", label: "Project Ideas", text: "Suggest some beginner-friendly project ideas for: " },
];

function groupConversations(list) {
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const today = startOfDay(new Date());
  const yesterday = today - 86400000;
  const groups = { Today: [], Yesterday: [], Older: [] };
  list.forEach(c => {
    const raw = (c.created_at || "").replace(" ", "T") + "Z";
    const t = startOfDay(new Date(raw));
    if (t === today) groups.Today.push(c);
    else if (t === yesterday) groups.Yesterday.push(c);
    else groups.Older.push(c);
  });
  return groups;
}

function TypingDots({ color }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "3px 2px" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: color,
          animation: "cmBounce 1.2s infinite ease-in-out", animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  );
}

export default function ChatView({ token, username, onLogout, theme, mode, onToggleTheme }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([WELCOME]);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [showRightPanel, setShowRightPanel] = useState(typeof window !== "undefined" && window.innerWidth >= 1150);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("Auto-detect");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setShowRightPanel(window.innerWidth >= 1150);
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const refreshConversations = async () => {
    try {
      const data = await api.listConversations(token);
      setConversations(data.conversations || []);
      return data.conversations || [];
    } catch (e) {
      console.error("Failed to load conversations:", e);
      return [];
    }
  };

  useEffect(() => {
    (async () => {
      const list = await refreshConversations();
      const savedId = localStorage.getItem(`cm_active_chat:${username}`);
      const stillExists = savedId && list.some(c => String(c.id) === savedId);
      const idToOpen = stillExists ? Number(savedId) : (list.length ? list[0].id : null);
      if (idToOpen) openConversation(idToOpen);
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const openConversation = async (id) => {
    setActiveId(id);
    setImage(null);
    localStorage.setItem(`cm_active_chat:${username}`, String(id));
    if (isMobile) setSidebarOpen(false);
    try {
      const data = await api.getMessages(token, id);
      const msgs = (data.messages || []).map(m => ({ id: m.id, role: m.role, text: m.content, image: m.image, time: m.created_at }));
      setMessages(msgs.length ? msgs : [WELCOME]);
    } catch (e) {
      console.error("Failed to load chat:", e);
      setMessages([WELCOME]);
    }
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([WELCOME]);
    setImage(null);
    setInput("");
    localStorage.removeItem(`cm_active_chat:${username}`);
    if (isMobile) setSidebarOpen(false);
  };

  const removeConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this chat?")) return;
    try {
      await api.deleteConversation(token, id);
      if (id === activeId) {
        localStorage.removeItem(`cm_active_chat:${username}`);
        startNewChat();
      }
      refreshConversations();
    } catch (e) { console.error("Failed to delete chat:", e); }
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setImage({ dataUrl: reader.result, mediaType: file.type });
    reader.readAsDataURL(file);
  };

  const onPaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        handleFile(item.getAsFile());
        break;
      }
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const send = () => sendText(input.trim());

  const sendText = async (text) => {
    if ((!text && !image) || loading || sendingRef.current) return;
    sendingRef.current = true;
    const userMsg = { id: uid(), role: "user", text: text || "(sent a screenshot)", image: image ? image.dataUrl : null, time: new Date() };
    const assistantId = uid();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: "assistant", text: "", time: new Date() }]);
    setInput("");
    const pendingImage = image;
    setImage(null);
    setLoading(true);

    try {
      let accumulated = "";
      const { conversationId } = await api.sendStream(
        token,
        { conversationId: activeId, text: text || "(sent a screenshot)", image: pendingImage, lang },
        (chunk) => {
          accumulated += chunk;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: accumulated } : m));
        }
      );
      if (!activeId && conversationId) {
        setActiveId(conversationId);
        localStorage.setItem(`cm_active_chat:${username}`, String(conversationId));
      }
      refreshConversations();
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: e.message || "Something went wrong. Please try again." } : m));
    }
    setLoading(false);
    sendingRef.current = false;
  };

  const sendImage = async (prompt) => {
    if (!prompt || loading) return;
    const userMsg = { id: uid(), role: "user", text: `🎨 ${prompt}`, time: new Date() };
    const assistantId = uid();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: "assistant", text: "", generating: true, time: new Date() }]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.generateImage(token, { conversationId: activeId, prompt });
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, text: "Here's your generated image:", image: data.image, generating: false }
        : m));
      if (!activeId && data.conversationId) {
        setActiveId(data.conversationId);
        localStorage.setItem(`cm_active_chat:${username}`, String(data.conversationId));
      }
      refreshConversations();
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, text: e.message || "Something went wrong generating the image.", generating: false }
        : m));
    }
    setLoading(false);
  };

  const applyQuickAction = (text) => {
    setInput(text);
    setQuickActionsOpen(false);
  };

  const groups = groupConversations(conversations);
  const activeTitle = conversations.find(c => c.id === activeId)?.title || "New Chat";

  const QuickActionsList = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {QUICK_ACTIONS.map(qa => (
        <button key={qa.label} onClick={() => applyQuickAction(qa.text)} style={{
          display: "flex", alignItems: "center", gap: 10, background: theme.neuBg, border: "none",
          borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left",
          fontSize: 13, color: theme.textDark, fontWeight: 600, width: "100%",
          boxShadow: theme.neuShadowOut,
        }}>
          <i className={["fa-regular fa-file-lines", "fa-solid fa-bug", "fa-solid fa-code", "fa-solid fa-wand-magic-sparkles", "fa-regular fa-lightbulb"][QUICK_ACTIONS.indexOf(qa)]} aria-hidden="true" style={{ width: 18, fontSize: 16, textAlign: "center" }} />
          {qa.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ height: "100vh", width: "100%", display: "flex", background: theme.pageBg, color: theme.textDark, fontFamily: "'Space Grotesk', sans-serif", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes cmBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes cmFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: theme.overlayBg, zIndex: 55 }} />
      )}

      {/* ---------- left sidebar ---------- */}
      <div style={isMobile ? {
        position: "fixed", top: 0, left: 0, height: "100vh", width: 280, zIndex: 60,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform .25s ease", background: theme.sidebarBg,
        display: "flex", flexDirection: "column",
      } : {
        width: sidebarOpen ? 264 : 0, flexShrink: 0, overflow: "hidden",
        transition: "width .25s ease", background: theme.sidebarBg,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "100%", minWidth: 264, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingLeft: 2 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: theme.neuBg, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: theme.sidebarText,
              boxShadow: theme.neuShadowOut,
            }}>
              <i className="fa-solid fa-code" aria-hidden="true" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: theme.sidebarText, letterSpacing: 0.3 }}>CodeMentor</span>
          </div>

          <button onClick={startNewChat} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "#ffffff", color: "#1a1d23", border: "none", borderRadius: 24,
            padding: "12px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", marginBottom: 14,
          }}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> New Chat
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
            {[
              { icon: "🏠", label: "Home", onClick: startNewChat },
              { icon: "🧭", label: "Explore", onClick: () => setQuickActionsOpen(o => !o) },
              { icon: "⚙️", label: "Settings", onClick: () => setSettingsOpen(true) },
            ].map(nav => (
              <button key={nav.label} onClick={nav.onClick} style={{
                display: "flex", alignItems: "center", gap: 10, background: theme.neuBg, border: "none",
                borderRadius: 9, padding: "8px 10px", cursor: "pointer", textAlign: "left",
                fontSize: 13, color: theme.sidebarTextMuted, fontWeight: 500, boxShadow: theme.neuShadowOut,
              }}>
                <i className={{ Home: "fa-solid fa-house", Explore: "fa-solid fa-magnifying-glass", Settings: "fa-solid fa-gear" }[nav.label]} aria-hidden="true" style={{ width: 16, fontSize: 14, textAlign: "center" }} />
                {nav.label}
              </button>
            ))}
          </div>

          {quickActionsOpen && (
            <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10.5, color: theme.sidebarTextMuted, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>QUICK ACTIONS</div>
              {QUICK_ACTIONS.map(qa => (
                <button key={qa.label} onClick={() => applyQuickAction(qa.text)} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", background: theme.neuBg, border: "none",
                  borderRadius: 8, padding: "7px 6px", cursor: "pointer", textAlign: "left",
                  fontSize: 12.5, color: theme.sidebarText, boxShadow: theme.neuShadowOut,
                }}>
                  <i className={["fa-regular fa-file-lines", "fa-solid fa-bug", "fa-solid fa-code", "fa-solid fa-wand-magic-sparkles", "fa-regular fa-lightbulb"][QUICK_ACTIONS.indexOf(qa)]} aria-hidden="true" style={{ width: 16, textAlign: "center" }} />{qa.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {conversations.length === 0 && (
              <div style={{ fontSize: 12.5, color: theme.sidebarTextMuted, padding: "10px 2px" }}>No saved chats yet.</div>
            )}
            {["Today", "Yesterday", "Older"].map(label => (
              groups[label].length > 0 && (
                <div key={label}>
                  <div style={{ fontSize: 10.5, color: theme.sidebarTextMuted, letterSpacing: 1.2, marginBottom: 7, paddingLeft: 6, fontWeight: 700 }}>
                    {label.toUpperCase()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {groups[label].map(c => (
                      <div key={c.id} onClick={() => openConversation(c.id)} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                        padding: "9px 10px 9px 13px", borderRadius: 9, cursor: "pointer",
                        background: theme.neuBg,
                        borderLeft: c.id === activeId ? theme.sidebarActiveBorder : "3px solid transparent",
                        boxShadow: theme.neuShadowOut,
                      }}>
                        <span style={{
                          fontSize: 13, color: c.id === activeId ? theme.sidebarText : theme.sidebarTextMuted,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
                          fontWeight: c.id === activeId ? 600 : 400,
                        }}>
                          {c.title}
                        </span>
                        <button onClick={(e) => removeConversation(c.id, e)} title="Delete" style={{
                          background: "transparent", border: "none", cursor: "pointer", fontSize: 0,
                          color: theme.danger, opacity: 0.6, flexShrink: 0,
                        }}>
                          <i className="fa-regular fa-trash-can" aria-label="Delete chat" style={{ fontSize: 12 }} />
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          <div onClick={() => setSettingsOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 10,
            cursor: "pointer", marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: theme.ctaGradient, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#ffffff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
            }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.sidebarText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{username}</div>
              <div style={{ fontSize: 10.5, color: theme.sidebarTextMuted }}>CodeMentor account</div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- main area ---------- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: theme.glassBgSolid, borderBottom: theme.glassBorder,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button onClick={() => setSidebarOpen(s => !s)} style={{
              background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: theme.textDark, padding: 4, flexShrink: 0,
            }}>
              ☰
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.textDark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeTitle}</div>
              <div style={{ fontSize: 11.5, color: theme.textMuted }}>Let's build something amazing together</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 4, background: theme.neuBg, color: theme.textDark,
              borderRadius: 20, fontSize: 11.5, padding: "6px 10px", fontWeight: 600, boxShadow: theme.neuShadowOut,
            }}>
              ⚡ Gemini Flash
            </span>
            <select value={lang} onChange={e => setLang(e.target.value)} style={{
              background: theme.neuBg, color: theme.textDark, border: "none", borderRadius: 20,
              fontSize: 11.5, padding: "6px 10px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
              boxShadow: theme.neuShadowOut,
            }}>
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button onClick={onToggleTheme} title="Toggle theme" style={{
              background: theme.neuBg, border: "none", color: theme.textDark,
              borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 0,
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: theme.neuShadowOut,
            }}>
              <i className={mode === "dark" ? "fa-regular fa-moon" : "fa-regular fa-sun"} aria-label={mode === "dark" ? "Dark theme" : "Light theme"} style={{ fontSize: 14 }} />
            </button>
            <button onClick={() => setSettingsOpen(s => !s)} title="Account" style={{
              background: theme.neuBg, border: "none", color: theme.textDark,
              borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: theme.neuShadowOut,
            }}>
              <i className="fa-regular fa-user" aria-hidden="true" />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <>
            <div onClick={() => setSettingsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 70 }} />
            <div style={{
              position: "fixed", top: 60, right: 16, width: 230, zIndex: 71,
              background: theme.glassBgSolid, border: theme.glassBorder, borderRadius: 16, padding: 16, boxShadow: theme.glassShadow,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: theme.textDark }}>{username}</div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 16 }}>CodeMentor account</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: theme.textDark }}>
                  <i className={mode === "dark" ? "fa-regular fa-moon" : "fa-regular fa-sun"} aria-hidden="true" style={{ marginRight: 7 }} />
                  {mode === "dark" ? "Dark theme" : "Light theme"}
                </span>
                <button onClick={onToggleTheme} style={{
                  width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
                  background: mode === "dark" ? theme.ctaGradient : theme.toggleTrack, transition: "background .2s", flexShrink: 0,
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: mode === "dark" ? 21 : 3, width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", transition: "left .2s", boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                  }} />
                </button>
              </div>

              <button onClick={onLogout} style={{
                width: "100%", padding: "9px 0", borderRadius: 10, border: `1px solid ${theme.danger}55`,
                background: theme.neuBg, color: theme.danger, fontWeight: 700, fontSize: 12.5, cursor: "pointer", boxShadow: theme.neuShadowOut,
              }}>
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" style={{ marginRight: 7 }} /> Logout
              </button>
            </div>
          </>
        )}

        <div
          ref={scrollRef}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{ flex: 1, overflowY: "auto", padding: "18px 14px", position: "relative" }}
        >
          {dragOver && (
            <div style={{
              position: "absolute", inset: 10, border: `2px dashed ${theme.accent}`, borderRadius: 18,
              background: "rgba(43,47,56,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, color: theme.accent, fontWeight: 700, zIndex: 5, pointerEvents: "none",
            }}>
              Drop your screenshot here
            </div>
          )}
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {messages.map(m => (
              <div key={m.id} style={{
                display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-end",
                flexDirection: m.role === "user" ? "row-reverse" : "row",
                animation: "cmFadeIn .25s ease",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0, fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: m.role === "user" ? theme.ctaGradient : theme.neuBg,
                  color: m.role === "user" ? "#ffffff" : theme.textDark,
                  boxShadow: m.role === "user" ? "0 4px 10px rgba(0,0,0,0.2)" : theme.neuShadowOut,
                }}>
                  {m.role === "user" ? username.charAt(0).toUpperCase() : <i className="fa-solid fa-robot" aria-label="CodeMentor AI" />}
                </div>
                <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    background: m.role === "user" ? theme.bubbleUserBg : theme.bubbleAssistantBg,
                    border: m.role === "user" ? "none" : theme.bubbleAssistantBorder,
                    borderRadius: 16,
                    padding: "11px 15px", fontSize: 14.5,
                    color: m.role === "user" ? theme.bubbleUserText : theme.textDark,
                    boxShadow: m.role === "user" ? "0 6px 18px rgba(43,47,56,0.25)" : "0 2px 10px rgba(0,0,0,0.04)",
                  }}>
                    {m.image && (
                      <img src={m.image} alt="screenshot" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 8, display: "block" }} />
                    )}
                    {m.role === "assistant" && m.generating ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TypingDots color={theme.accent} />
                        <span style={{ fontSize: 12.5, color: theme.textMuted }}>Generating image...</span>
                      </div>
                    ) : m.role === "assistant" && m.text === "" && loading ? (
                      <TypingDots color={theme.accent} />
                    ) : (
                      <MessageContent text={m.text} theme={theme} />
                    )}
                    {m.role === "assistant" && m.text.includes("```") && !loading && (
                      <button onClick={() => sendText("Please explain this step-by-step in simple terms.")} style={{
                        marginTop: 6, background: "rgba(43,47,56,0.12)", border: "1px solid rgba(43,47,56,0.35)", color: theme.accent,
                        fontSize: 11.5, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                      }}>
                        ✦ explain this
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4, padding: "0 4px" }}>
                    {formatTime(m.time)}
                  </span>
                </div>
              </div>
            ))}
            {messages.length === 1 && !loading && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 16, marginLeft: 38 }}>
                {STARTERS.map(s => (
                  <button key={s.label} onClick={() => setInput(s.text)} style={{
                    background: theme.glassBgSolid, border: theme.glassBorder, color: theme.textDark,
                    borderRadius: 20, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* input bar */}
        <div style={{ padding: "14px", background: theme.glassBgSolid, borderTop: theme.glassBorder }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {image && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8,
                background: theme.neuBg, borderRadius: 10, padding: "6px 8px",
              }}>
                <img src={image.dataUrl} alt="preview" style={{ height: 40, borderRadius: 6 }} />
                <span style={{ fontSize: 12, color: theme.textMuted }}>screenshot attached</span>
                <button onClick={() => setImage(null)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            )}
            <div style={{
              display: "flex", gap: 6, alignItems: "center", background: theme.neuBg,
              borderRadius: 28, padding: "6px 8px 6px 16px", boxShadow: theme.neuShadowOut,
            }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0])} />
              <button onClick={() => fileInputRef.current?.click()} title="Attach a screenshot" style={{
                background: "transparent", border: "none", color: theme.textMuted,
                cursor: "pointer", fontSize: 17, lineHeight: 1, padding: 4, flexShrink: 0,
              }}>
                📎
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                onPaste={onPaste}
                placeholder="Type your message..."
                rows={1}
                style={{
                  flex: 1, resize: "none", minHeight: 34, maxHeight: 140,
                  background: "transparent", color: theme.textDark, border: "none",
                  padding: "7px 4px", fontSize: 14,
                  fontFamily: "'Space Grotesk', sans-serif", outline: "none",
                }}
              />
              <button onClick={() => sendImage(input.trim())} disabled={!input.trim() || loading} title="Generate an image from this text" style={{
                background: theme.glassBgSolid, border: "none", color: theme.textMuted,
                cursor: (!input.trim() || loading) ? "default" : "pointer", fontSize: 15, lineHeight: 1,
                width: 30, height: 30, borderRadius: "50%",
                opacity: (!input.trim() || loading) ? 0.4 : 1, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}>
                ✨
              </button>
              <button onClick={send} disabled={loading || (!input.trim() && !image)} style={{
                background: theme.navyGradient, color: "#fff", border: "none", borderRadius: "50%",
                width: 38, height: 38, fontWeight: 700, fontSize: 15, flexShrink: 0,
                cursor: (loading || (!input.trim() && !image)) ? "default" : "pointer",
                opacity: (loading || (!input.trim() && !image)) ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              }}>
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- right panel ---------- */}
      {showRightPanel && (
        <div style={{ width: 260, flexShrink: 0, padding: 16, overflowY: "auto", boxSizing: "border-box" }}>
          <div style={{
            background: theme.glassBgSolid, border: theme.glassBorder, borderRadius: 18, padding: "22px 18px",
            textAlign: "center", marginBottom: 16, boxShadow: theme.glassShadow,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: theme.neuBg, margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, color: theme.textDark,
              boxShadow: theme.neuShadowOut,
            }}>
              <i className="fa-solid fa-code" aria-hidden="true" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.textDark }}>CodeMentor</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, marginBottom: 10 }}>Your AI Coding Assistant</div>
            <div style={{ fontSize: 11, color: theme.accent, fontStyle: "italic", fontWeight: 600 }}>
              "Think • Code • Learn • Build"
            </div>
          </div>

          <div style={{
            background: theme.glassBgSolid, border: theme.glassBorder, borderRadius: 18, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark, marginBottom: 12 }}>Quick Actions</div>
            <QuickActionsList />
          </div>

          <div style={{
            background: theme.glassBgSolid, border: theme.glassBorder, borderRadius: 18, padding: "18px 16px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 12.5, color: theme.textMuted, lineHeight: 1.5 }}>
              Good Code<br />Builds a Better You
            </div>
            <div style={{ fontSize: 18, marginTop: 8, color: theme.accent }}>♥</div>
          </div>
        </div>
      )}
    </div>
  );
}
