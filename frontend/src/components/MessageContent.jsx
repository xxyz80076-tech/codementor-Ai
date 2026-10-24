import React, { useState } from "react";

function parseMessage(text) {
  const parts = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1] || "", content: match[2].replace(/\n$/, "") });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
  return parts;
}

function formatInline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} style={{ padding: "1px 4px", borderRadius: 4, background: "rgba(127,127,127,.14)" }}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function FormattedText({ content }) {
  const lines = content.split("\n");
  const items = [];
  let bullets = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    items.push(<ul key={`list-${items.length}`} style={{ margin: "6px 0", paddingLeft: 20 }}>{bullets.map((item, i) => <li key={i}>{formatInline(item)}</li>)}</ul>);
    bullets = [];
  };

  lines.forEach((line, index) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) { bullets.push(bullet[1]); return; }
    flushBullets();
    if (!line.trim()) return;
    if (heading) {
      items.push(<div key={index} style={{ fontSize: 18 - (heading[1].length - 1) * 2, fontWeight: 700, margin: "12px 0 5px" }}>{formatInline(heading[2])}</div>);
      return;
    }
    if (/^\|?\s*[-:]{3,}/.test(line)) return;
    const cleanLine = line.replace(/^\|\s?/, "").replace(/\s?\|$/, "").replace(/\s*\|\s*/g, " · ");
    items.push(<p key={index} style={{ whiteSpace: "pre-wrap", margin: "6px 0", lineHeight: 1.65 }}>{formatInline(cleanLine)}</p>);
  });
  flushBullets();
  return items;
}

function CodeBlock({ lang, content, theme }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{
      background: theme.codeBg, border: `1px solid ${theme.codeBorder}`, borderRadius: 12,
      overflow: "hidden", margin: "10px 0", boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "7px 13px", background: theme.codeHeaderBg, borderBottom: `1px solid ${theme.codeBorder}`,
      }}>
        <span style={{ fontSize: 11, color: "#7c8ba1", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
          {lang ? lang.toUpperCase() : "CODE"}
        </span>
        <button onClick={copy} style={{
          background: "transparent", border: `1px solid ${theme.codeBorder}`, color: copied ? theme.accent : "#9fb0c3",
          fontSize: 0, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
        }}>
          <i className={copied ? "fa-solid fa-check" : "fa-regular fa-copy"} aria-label={copied ? "Copied" : "Copy code"} style={{ fontSize: 11 }} />
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: "13px 15px", overflowX: "auto",
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, lineHeight: 1.6,
        color: theme.codeText,
      }}><code>{content}</code></pre>
    </div>
  );
}

export default function MessageContent({ text, theme }) {
  const parts = parseMessage(text);
  return (
    <div>
      {parts.map((p, i) => {
        if (p.type === "code") return <CodeBlock key={i} lang={p.lang} content={p.content} theme={theme} />;
        if (!p.content.trim()) return null;
        return <FormattedText key={i} content={p.content} />;
      })}
    </div>
  );
}
