import React, { useState } from "react";
import { api } from "../api";

function Icon({ name, size = 20, stroke = "currentColor" }) {
  const shared = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const shapes = {
    code: <><path d="m8 9-3 3 3 3" /><path d="m16 9 3 3-3 3" /><path d="m14 5-4 14" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.1 3.1-5 7-5s6.3 1.9 7 5" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20.5 15.3A8.7 8.7 0 0 1 8.7 3.5 8.7 8.7 0 1 0 20.5 15.3Z" />,
  };
  return <svg {...shared}>{shapes[name]}</svg>;
}

export default function LoginView({ onLogin, theme, mode, onToggleTheme }) {
  const [formMode, setFormMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  const switchForm = nextMode => {
    if (nextMode === formMode) return;
    setError(""); setFormMode(nextMode); setFlipKey(key => key + 1);
  };

  const submit = async () => {
    setError("");
    if (!password.trim() || (formMode === "signup" && (!fullName.trim() || !email.trim())) || (formMode === "login" && !username.trim())) {
      setError(formMode === "signup" ? "Please complete all three fields." : "Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const data = formMode === "signup"
        ? await api.signup(fullName, email, password)
        : await api.login(username, password);
      onLogin(data.token, data.username);
    } catch (e) { setError(e.message || "Something went wrong. Please try again."); }
    setBusy(false);
  };

  const inputWrap = { display: "flex", alignItems: "center", gap: 10, width: "100%", height: 47, padding: "0 15px", boxSizing: "border-box", borderRadius: 15, background: theme.neuBg, boxShadow: theme.neuShadowIn, color: theme.textMuted, marginBottom: 12 };
  const inputStyle = { width: "100%", minWidth: 0, height: "100%", border: "none", outline: "none", background: "transparent", color: theme.textDark, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" };
  const field = (icon, placeholder, value, setValue, type = "text", autocomplete = "off") => <label style={inputWrap}><Icon name={icon} size={17} /><input type={type} autoComplete={autocomplete} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inputStyle} placeholder={placeholder} aria-label={placeholder} /></label>;

  return (
    <div style={{ minHeight: "100vh", width: "100%", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", background: theme.pageBg, fontFamily: "'Space Grotesk', sans-serif", color: theme.textDark, padding: 16, boxSizing: "border-box" }}>
      <style>{`@keyframes auth-card-flip { 0% { transform: rotateY(0) scale(1); } 48% { transform: rotateY(90deg) scale(.96); } 100% { transform: rotateY(360deg) scale(1); } } @media (max-width: 540px) { .auth-orbit { width: min(94vw, 500px) !important; height: min(94vw, 500px) !important; padding: 25px !important; } .auth-form-title { font-size: 29px !important; } }`}</style>
      <button onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle theme" style={{ position: "absolute", top: 20, right: 20, zIndex: 2, width: 42, height: 42, border: "none", borderRadius: "50%", background: theme.neuBg, color: theme.textDark, display: "grid", placeItems: "center", cursor: "pointer", boxShadow: theme.neuShadowOut }}><Icon name={mode === "dark" ? "moon" : "sun"} size={18} /></button>

      <main style={{ width: "100%", display: "grid", placeItems: "center", perspective: 1300 }}>
        <div className="auth-side-brand" style={{ position: "fixed", top: 18, left: 12, width: 190, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 10px", borderRadius: "50%", background: theme.logoGradient, color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 9px 20px rgba(43,47,56,.3)" }}><Icon name="code" size={23} stroke="#fff" /></div>
          <div style={{ fontSize: 14, letterSpacing: 2.4, fontWeight: 700 }}>CODE<span style={{ color: theme.accent }}>MENTOR</span></div>
          <p style={{ margin: "5px 0 0", color: theme.textMuted, fontSize: 12 }}>Your AI coding assistant</p>
        </div>
        <section key={flipKey} className="auth-orbit" aria-label={formMode === "login" ? "Login form" : "Sign up form"} style={{ width: 500, height: 500, maxWidth: "100%", maxHeight: "calc(100vw - 32px)", borderRadius: "50%", background: theme.neuBg, boxShadow: `${theme.neuShadowOut}, inset 7px 7px 15px rgba(43,47,56,.05)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 38, boxSizing: "border-box", transformStyle: "preserve-3d", animation: flipKey ? "auth-card-flip .68s cubic-bezier(.2,.72,.25,1)" : "none" }}>
          <div style={{ width: "100%", maxWidth: 285, textAlign: "center" }}>
            <h1 className="auth-form-title" style={{ margin: 0, fontSize: 33, letterSpacing: -1, lineHeight: 1.1 }}>{formMode === "login" ? "Login" : "Sign Up"}</h1>
            <p style={{ color: theme.textMuted, fontSize: 13, margin: "7px 0 19px" }}>{formMode === "login" ? "Sign in to your account" : "Create your account"}</p>
            {formMode === "signup" && field("user", "Full name", fullName, setFullName, "text", "name")}
            {formMode === "signup" && field("email", "Email", email, setEmail, "email", "email")}
            {formMode === "login" && field("email", "Email", username, setUsername, "email", "username")}
            {field("lock", "Password", password, setPassword, "password", formMode === "login" ? "current-password" : "new-password")}
            {error && <div role="alert" style={{ color: theme.danger, fontSize: 11.5, marginTop: -4, marginBottom: 7 }}>{error}</div>}
            <button onClick={submit} disabled={busy} style={{ width: "100%", height: 48, border: "none", borderRadius: 15, marginTop: 6, background: theme.ctaGradient, color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12.5, letterSpacing: .7, cursor: busy ? "default" : "pointer", opacity: busy ? .7 : 1, boxShadow: "0 9px 18px rgba(43,47,56,.28)" }}>{busy ? "PLEASE WAIT" : formMode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</button>
            <p style={{ margin: "15px 0 0", color: theme.textMuted, fontSize: 12 }}>{formMode === "login" ? "Don't have an account? " : "Already have an account? "}<button onClick={() => switchForm(formMode === "login" ? "signup" : "login")} style={{ border: "none", padding: 0, background: "transparent", color: theme.accent, font: "inherit", fontWeight: 700, cursor: "pointer" }}>{formMode === "login" ? "Sign up" : "Login"}</button></p>
          </div>
        </section>
      </main>
    </div>
  );
}
