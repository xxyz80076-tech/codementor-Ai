import React, { useState } from "react";
import LoginView from "./components/LoginView";
import ChatView from "./components/ChatView";
import { getTheme } from "./theme";

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("cm_token");
    const username = localStorage.getItem("cm_username");
    return token && username ? { token, username } : null;
  });

  const [mode, setMode] = useState(() => localStorage.getItem("cm_theme") || "light");
  const theme = getTheme(mode);

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("cm_theme", next);
      return next;
    });
  };

  const handleLogin = (token, username) => {
    localStorage.setItem("cm_token", token);
    localStorage.setItem("cm_username", username);
    setAuth({ token, username });
  };

  const handleLogout = () => {
    localStorage.removeItem("cm_token");
    localStorage.removeItem("cm_username");
    setAuth(null);
  };

  return auth
    ? <ChatView token={auth.token} username={auth.username} onLogout={handleLogout} theme={theme} mode={mode} onToggleTheme={toggleTheme} />
    : <LoginView onLogin={handleLogin} theme={theme} mode={mode} onToggleTheme={toggleTheme} />;
}
