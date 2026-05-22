import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";

/* ─── Theme ───────────────────────────────────────────────────────────────── */
const T = {
  bg: "#1C1917",
  bg2: "#211E1B",
  panel: "#272320",
  surface: "rgba(255,255,255,0.04)",
  surfaceHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.08)",
  text: "#E8E0D5",
  subtext: "#7A7068",
  muted: "#332E2A",
  accent: "#C4A882",
  accentText: "#1C1917",
  font: "'IM Fell English', Georgia, serif",
  monoFont: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English&family=DM+Mono:wght@300;400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${T.bg};color:${T.text};font-family:${T.font};}
  button{font-family:inherit;cursor:pointer;}
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
  ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2);}
  .rh-card{transition:background 0.15s, border-color 0.15s, transform 0.15s;}
  .rh-card:hover{background:${T.surfaceHover};}
  .rh-pill{transition:background 0.15s, color 0.15s, border-color 0.15s;}
  @keyframes rh-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  .rh-fade{animation:rh-fade 0.2s ease-out;}
`;

/* ─── Status helpers ──────────────────────────────────────────────────────── */
const STATUSES = ["toread", "inprogress", "completed", "dnf"];
const STATUS_LABEL = {
  toread: "To Read",
  inprogress: "In Progress",
  completed: "Completed",
  dnf: "DNF",
};
const STATUS_COLOR = {
  toread: "#7A7068",
  inprogress: "#C4A882",
  completed: "#6BAA75",
  dnf: "#9B5C5C",
};
function nextStatus(s) {
  const i = STATUSES.indexOf(s);
  return STATUSES[(i + 1) % STATUSES.length];
}

/* ─── Date helpers ────────────────────────────────────────────────────────── */
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/* ─── Books grouping & next-pick ─────────────────────────────────────────── */
function groupByGenre(books) {
  const map = new Map();
  for (const b of books) {
    const g = (b.genre || "Uncategorized").trim() || "Uncategorized";
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(b);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function pickNext(books) {
  const toread = books.filter((b) => b.status === "toread");
  if (toread.length === 0) return [];
  const inprogressCount = books.filter((b) => b.status === "inprogress").length;

  const lastCompletedByGenre = new Map();
  for (const b of books) {
    if (b.status !== "completed" || !b.finishDate) continue;
    const cur = lastCompletedByGenre.get(b.genre);
    if (!cur || b.finishDate > cur) lastCompletedByGenre.set(b.genre, b.finishDate);
  }

  const scored = toread.map((b) => {
    const last = lastCompletedByGenre.get(b.genre);
    const since = last ? daysSince(last) : 365;
    const score = since - inprogressCount * 7;
    return { book: b, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.book);
}

/* ─── Small UI atoms ──────────────────────────────────────────────────────── */
function StatusBadge({ status, onClick }) {
  const label = STATUS_LABEL[status] || "Unset";
  const color = STATUS_COLOR[status] || T.subtext;
  return (
    <button
      onClick={onClick}
      title={status ? `Click to cycle status` : "Click to set status"}
      style={{
        background: "transparent",
        border: `1px solid ${color}`,
        color,
        fontFamily: T.monoFont,
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 3,
      }}
      className="rh-pill"
    >
      {label}
    </button>
  );
}

function Rating({ value, onChange }) {
  const v = value || 0;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n === v ? null : n)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: n <= v ? T.accent : T.muted,
            fontSize: 13,
            lineHeight: 1,
          }}
          title={`Rate ${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/* ─── Book card ───────────────────────────────────────────────────────────── */
function BookCard({ book, onCycleStatus, onRate, onReveal }) {
  return (
    <div
      className="rh-card"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 130,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={onReveal}
            title="Reveal in Finder"
            style={{
              fontSize: 16,
              fontFamily: T.font,
              color: T.text,
              lineHeight: 1.25,
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {book.title}
          </div>
          {book.author && (
            <div
              style={{
                fontSize: 12,
                fontFamily: T.monoFont,
                color: T.subtext,
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {book.author}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <StatusBadge status={book.status} onClick={onCycleStatus} />
        <Rating value={book.myRate} onChange={onRate} />
      </div>
    </div>
  );
}

/* ─── Next-pick panel ─────────────────────────────────────────────────────── */
function NextPickPanel({ picks, onStart }) {
  if (picks.length === 0) return null;
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          fontFamily: T.monoFont,
          fontSize: 11,
          color: T.subtext,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          marginBottom: 12,
        }}
      >
        Next up
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {picks.map((b) => (
          <div
            key={b.filePath}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.title}
              </div>
              <div style={{ fontSize: 11, color: T.subtext, fontFamily: T.monoFont, marginTop: 2 }}>
                {b.author || b.genre}
              </div>
            </div>
            <button
              onClick={() => onStart(b)}
              style={{
                background: T.accent,
                color: T.accentText,
                border: "none",
                borderRadius: 3,
                padding: "6px 12px",
                fontSize: 12,
                fontFamily: T.monoFont,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Start this
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter pills ────────────────────────────────────────────────────────── */
function FilterPills({ value, onChange, counts }) {
  const pills = [
    { key: "all", label: "All" },
    { key: "toread", label: "To Read" },
    { key: "inprogress", label: "In Progress" },
    { key: "completed", label: "Completed" },
    { key: "dnf", label: "DNF" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {pills.map((p) => {
        const active = value === p.key;
        const count = counts[p.key];
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className="rh-pill"
            style={{
              background: active ? T.accent : "transparent",
              color: active ? T.accentText : T.subtext,
              border: `1px solid ${active ? T.accent : T.border}`,
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: T.monoFont,
              letterSpacing: 0.5,
            }}
          >
            {p.label}
            {count !== undefined && (
              <span style={{ marginLeft: 6, opacity: 0.6 }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Empty state (no vault) ─────────────────────────────────────────────── */
function VaultEmptyState({ onPick }) {
  return (
    <div
      className="rh-fade"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "80px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontFamily: T.font, color: T.text }}>Research Hub</div>
      <div style={{ fontSize: 14, color: T.subtext, maxWidth: 420, lineHeight: 1.5 }}>
        Choose your Obsidian vault to begin. The app reads book notes directly from the
        vault — frontmatter is the source of truth.
      </div>
      <button
        onClick={onPick}
        style={{
          background: T.accent,
          color: T.accentText,
          border: "none",
          borderRadius: 4,
          padding: "10px 18px",
          fontSize: 13,
          fontFamily: T.monoFont,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginTop: 6,
        }}
      >
        Choose vault
      </button>
    </div>
  );
}

/* ─── Books tab ───────────────────────────────────────────────────────────── */
function BooksTab({ books, loading, error, onCycleStatus, onRate, onStart, onReveal, onReload }) {
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c = { all: books.length, toread: 0, inprogress: 0, completed: 0, dnf: 0 };
    for (const b of books) if (c[b.status] !== undefined) c[b.status]++;
    return c;
  }, [books]);

  const filtered = useMemo(() => {
    if (filter === "all") return books;
    return books.filter((b) => b.status === filter);
  }, [books, filter]);

  const grouped = useMemo(() => groupByGenre(filtered), [filtered]);
  const picks = useMemo(() => pickNext(books), [books]);

  if (error) {
    return (
      <div style={{ padding: 40, color: "#9B5C5C", fontFamily: T.monoFont, fontSize: 13 }}>
        Couldn't read vault: {error}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={onReload}
            style={{
              background: "transparent",
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 3,
              padding: "6px 12px",
              fontSize: 12,
              fontFamily: T.monoFont,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading && books.length === 0) {
    return (
      <div style={{ padding: 40, color: T.subtext, fontFamily: T.monoFont, fontSize: 13 }}>
        Reading vault…
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div style={{ padding: 40, color: T.subtext, fontFamily: T.monoFont, fontSize: 13 }}>
        No book notes found in vault. Tag a note with <code>#book</code> or set{" "}
        <code>Source: Book</code> in its frontmatter.
      </div>
    );
  }

  return (
    <div className="rh-fade" style={{ padding: "24px 28px 60px" }}>
      <NextPickPanel picks={picks} onStart={onStart} />

      <div style={{ marginBottom: 24 }}>
        <FilterPills value={filter} onChange={setFilter} counts={counts} />
      </div>

      {grouped.length === 0 && (
        <div style={{ color: T.subtext, fontFamily: T.monoFont, fontSize: 13, padding: 20 }}>
          No books match this filter.
        </div>
      )}

      {grouped.map(([genre, items]) => (
        <section key={genre} style={{ marginBottom: 36 }}>
          <h2
            style={{
              fontFamily: T.font,
              fontSize: 14,
              color: T.subtext,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: "normal",
              marginBottom: 12,
              paddingBottom: 6,
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {genre}{" "}
            <span style={{ color: T.muted, fontSize: 12, marginLeft: 6 }}>{items.length}</span>
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {items.map((b) => (
              <BookCard
                key={b.filePath}
                book={b}
                onCycleStatus={() => onCycleStatus(b)}
                onRate={(n) => onRate(b, n)}
                onReveal={() => onReveal(b)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Placeholder tabs ────────────────────────────────────────────────────── */
function PlaceholderTab({ title, body }) {
  return (
    <div className="rh-fade" style={{ padding: "60px 40px", textAlign: "center" }}>
      <div style={{ fontFamily: T.font, fontSize: 22, color: T.text, marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.subtext, letterSpacing: 0.5 }}>
        {body}
      </div>
    </div>
  );
}

/* ─── Settings popover ────────────────────────────────────────────────────── */
function SettingsPopover({ prefs, onSave, onClose }) {
  const api = typeof window !== "undefined" ? window.researchHub : null;
  const [tavilyKey, setTavilyKey] = useState(prefs?.tavilyApiKey || "");
  const [groqKey, setGroqKey] = useState(prefs?.groqApiKey || "");
  const [groqModel, setGroqModel] = useState(prefs?.groqModel || "llama-3.3-70b-versatile");
  const [clipperFolder, setClipperFolder] = useState(prefs?.clipperFolder || "");
  const [dailyNoteFolder, setDailyNoteFolder] = useState(prefs?.dailyNoteFolder || "");
  const [dailyNoteIntegration, setDailyNoteIntegration] = useState(
    !!prefs?.dailyNoteIntegration,
  );
  const [zoteroPort, setZoteroPort] = useState(
    prefs?.zoteroPort ? String(prefs.zoteroPort) : "23119",
  );
  const [storePath, setStorePath] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api?.prefs.storePath().then((p) => setStorePath(p));
  }, [api]);

  const save = async () => {
    const portNum = parseInt(zoteroPort, 10);
    setSaving(true);
    await onSave({
      tavilyApiKey: tavilyKey.trim(),
      groqApiKey: groqKey.trim(),
      groqModel: groqModel.trim() || "llama-3.3-70b-versatile",
      clipperFolder: clipperFolder.trim(),
      dailyNoteFolder: dailyNoteFolder.trim(),
      dailyNoteIntegration,
      zoteroPort: Number.isFinite(portNum) && portNum > 0 ? portNum : 23119,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 80,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rh-fade"
        style={{
          width: 520,
          maxWidth: "92vw",
          maxHeight: "90vh",
          overflowY: "auto",
          background: T.panel,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: 24,
        }}
      >
        <div
          style={{
            fontFamily: T.font,
            fontSize: 18,
            color: T.text,
            marginBottom: 20,
          }}
        >
          Settings
        </div>

        <SettingsSection title="Search & AI" />

        <Field label="Tavily API key" hint="Get one at tavily.com. 1000 searches/month free, no credit card.">
          <input
            type="password"
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            placeholder="tvly-…"
            style={inputStyle}
          />
        </Field>

        <Field label="Groq API key" hint="Powers the Synthesize button. Get one at console.groq.com.">
          <input
            type="password"
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            placeholder="gsk_…"
            style={inputStyle}
          />
        </Field>

        <Field label="Groq model" hint="Default: llama-3.3-70b-versatile. Try openai/gpt-oss-120b for tougher syntheses.">
          <input
            type="text"
            value={groqModel}
            onChange={(e) => setGroqModel(e.target.value)}
            placeholder="llama-3.3-70b-versatile"
            style={inputStyle}
          />
        </Field>

        <SettingsSection title="Captures &amp; Clipper" />

        <Field
          label="Web Clipper folder"
          hint="Vault-relative path where Obsidian Web Clipper saves notes."
        >
          <input
            type="text"
            value={clipperFolder}
            onChange={(e) => setClipperFolder(e.target.value)}
            placeholder="Clippings"
            style={inputStyle}
          />
        </Field>

        <Field
          label="Daily note folder"
          hint="Vault-relative path, e.g. Daily. Captures can optionally log here."
        >
          <input
            type="text"
            value={dailyNoteFolder}
            onChange={(e) => setDailyNoteFolder(e.target.value)}
            placeholder="Daily"
            style={inputStyle}
          />
        </Field>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontFamily: T.monoFont,
            fontSize: 12,
            color: T.subtext,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={dailyNoteIntegration}
            onChange={(e) => setDailyNoteIntegration(e.target.checked)}
          />
          Log captures to today's daily note by default
        </label>

        <SettingsSection title="Zotero" />

        <Field
          label="Local API port"
          hint="Default 23119. Change only if your Zotero is listening elsewhere."
        >
          <input
            type="number"
            min={1}
            max={65535}
            value={zoteroPort}
            onChange={(e) => setZoteroPort(e.target.value)}
            style={{ ...inputStyle, fontFamily: T.monoFont, width: 140 }}
          />
        </Field>

        <SettingsSection title="App data" />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            marginBottom: 14,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: T.monoFont,
                fontSize: 10,
                color: T.subtext,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 2,
              }}
            >
              store.json
            </div>
            <div
              title={storePath}
              style={{
                fontFamily: T.monoFont,
                fontSize: 11,
                color: T.muted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {storePath || "…"}
            </div>
          </div>
          <button
            onClick={() => api?.prefs.revealStore()}
            disabled={!storePath}
            style={{ ...buttonGhostStyle, padding: "5px 12px", whiteSpace: "nowrap" }}
          >
            Reveal
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={buttonGhostStyle}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} style={buttonPrimaryStyle}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  padding: "8px 10px",
  color: T.text,
  fontFamily: T.monoFont,
  fontSize: 12,
  outline: "none",
};

const buttonPrimaryStyle = {
  background: T.accent,
  color: T.accentText,
  border: "none",
  borderRadius: 3,
  padding: "8px 14px",
  fontSize: 12,
  fontFamily: T.monoFont,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

const buttonGhostStyle = {
  background: "transparent",
  color: T.subtext,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  padding: "8px 14px",
  fontSize: 12,
  fontFamily: T.monoFont,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

function SettingsSection({ title }) {
  return (
    <div
      style={{
        fontFamily: T.monoFont,
        fontSize: 10,
        color: T.accent,
        textTransform: "uppercase",
        letterSpacing: 2,
        marginTop: 18,
        marginBottom: 10,
        paddingBottom: 4,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {title}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontFamily: T.monoFont,
          fontSize: 11,
          color: T.subtext,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.muted, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ─── Research tab ────────────────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function ResearchTab({
  sessions,
  activeSession,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onSearch,
  onSynthesize,
  onSaveResult,
  onAddClipped,
  onRemoveCapture,
  onCapture,
  clipped,
  reloadClipped,
  prefs,
  onOpenSettings,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [synthesis, setSynthesis] = useState(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTopic, setEditTopic] = useState("");

  useEffect(() => {
    setEditName(activeSession?.name || "");
    setEditTopic(activeSession?.topic || "");
    setEditing(false);
  }, [activeSession?.id]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSynthesis(null);
    setSynthesisError(null);
    const res = await onSearch(query.trim());
    if (res.ok) {
      setResults(res.results);
    } else {
      setResults([]);
      setSearchError(res.error);
    }
    setSearching(false);
  };

  const runSynthesize = async () => {
    if (!results.length || !query.trim()) return;
    setSynthesizing(true);
    setSynthesisError(null);
    const res = await onSynthesize(query.trim(), activeSession?.topic || "", results);
    if (res.ok) {
      setSynthesis(res.text);
    } else {
      setSynthesis(null);
      setSynthesisError(res.error);
    }
    setSynthesizing(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateSession(newName.trim(), newTopic.trim());
    setNewName("");
    setNewTopic("");
  };

  const captureKey = (c) => {
    if (c.type === "search" && c.url) return `url:${c.url}`;
    if (c.type === "clipped" && c.filePath) return `path:${c.filePath}`;
    return null;
  };

  const savedKeys = useMemo(() => {
    const set = new Set();
    if (!activeSession) return set;
    for (const c of activeSession.captures) {
      const k = captureKey(c);
      if (k) set.add(k);
    }
    return set;
  }, [activeSession]);

  const hasSearchKey = !!prefs?.tavilyApiKey;
  const hasGroqKey = !!prefs?.groqApiKey;
  const synthDisabled = !hasGroqKey || synthesizing || results.length === 0;

  return (
    <div
      className="rh-fade"
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        gap: 0,
        minHeight: "calc(100vh - 56px)",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          borderRight: `1px solid ${T.border}`,
          padding: "20px 16px",
          background: T.bg2,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: T.monoFont,
            fontSize: 11,
            color: T.subtext,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            marginBottom: 12,
          }}
        >
          Sessions
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New session name"
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Topic (optional)"
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            style={{
              ...buttonPrimaryStyle,
              width: "100%",
              opacity: newName.trim() ? 1 : 0.4,
            }}
          >
            Start session
          </button>
        </div>

        {sessions.length === 0 && (
          <div style={{ color: T.muted, fontSize: 12, fontFamily: T.monoFont, padding: "8px 4px" }}>
            No sessions yet.
          </div>
        )}

        {sessions.map((s) => {
          const active = activeSession?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: active ? T.surface : "transparent",
                border: `1px solid ${active ? T.border : "transparent"}`,
                borderRadius: 4,
                padding: "8px 10px",
                marginBottom: 4,
                color: active ? T.text : T.subtext,
              }}
            >
              <div style={{ fontFamily: T.font, fontSize: 14 }}>{s.name}</div>
              {s.topic && (
                <div
                  style={{
                    fontFamily: T.monoFont,
                    fontSize: 11,
                    color: T.muted,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.topic}
                </div>
              )}
              <div
                style={{
                  fontFamily: T.monoFont,
                  fontSize: 10,
                  color: T.muted,
                  marginTop: 2,
                }}
              >
                {s.captures.length} {s.captures.length === 1 ? "capture" : "captures"}
              </div>
            </button>
          );
        })}
      </aside>

      {/* Main panel */}
      <section style={{ padding: "24px 28px 60px", overflowY: "auto" }}>
        {!activeSession ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              color: T.subtext,
              fontFamily: T.monoFont,
              fontSize: 13,
            }}
          >
            Create or select a session to begin.
          </div>
        ) : (
          <>
            {/* Session header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 24,
                paddingBottom: 16,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ ...inputStyle, fontSize: 16, fontFamily: T.font }}
                    />
                    <input
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      placeholder="Topic"
                      style={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={async () => {
                          await onRenameSession(activeSession.id, editName, editTopic);
                          setEditing(false);
                        }}
                        style={buttonPrimaryStyle}
                      >
                        Save
                      </button>
                      <button onClick={() => setEditing(false)} style={buttonGhostStyle}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontFamily: T.font, fontSize: 22, color: T.text }}>
                      {activeSession.name}
                    </div>
                    {activeSession.topic && (
                      <div
                        style={{
                          fontFamily: T.monoFont,
                          fontSize: 12,
                          color: T.subtext,
                          marginTop: 4,
                        }}
                      >
                        {activeSession.topic}
                      </div>
                    )}
                  </>
                )}
              </div>
              {!editing && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditing(true)} style={buttonGhostStyle}>
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${activeSession.name}"?`)) onDeleteSession(activeSession.id);
                    }}
                    style={{
                      ...buttonGhostStyle,
                      color: "#9B5C5C",
                      borderColor: "rgba(155,92,92,0.4)",
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader title="Web Search" />
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder={hasSearchKey ? "Search the web…" : "Set Tavily API key in Settings to search"}
                  disabled={!hasSearchKey}
                  style={{ ...inputStyle, fontSize: 13, flex: 1 }}
                />
                <button
                  onClick={runSearch}
                  disabled={!hasSearchKey || searching || !query.trim()}
                  style={{
                    ...buttonPrimaryStyle,
                    opacity: !hasSearchKey || searching || !query.trim() ? 0.4 : 1,
                  }}
                >
                  {searching ? "…" : "Search"}
                </button>
                <button
                  onClick={runSynthesize}
                  disabled={synthDisabled}
                  title={
                    !hasGroqKey
                      ? "Set Groq API key in Settings"
                      : results.length === 0
                      ? "Run a search first"
                      : "Synthesize the current results"
                  }
                  style={{
                    ...buttonGhostStyle,
                    color: T.accent,
                    borderColor: synthDisabled ? T.border : T.accent,
                    opacity: synthDisabled ? 0.4 : 1,
                    cursor: synthDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  {synthesizing ? "Synthesizing…" : "Synthesize"}
                </button>
              </div>
              {!hasSearchKey && (
                <div style={{ fontSize: 12, fontFamily: T.monoFont, color: T.muted }}>
                  Open Settings to add your Tavily API key.{" "}
                  <button
                    onClick={onOpenSettings}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.accent,
                      fontFamily: T.monoFont,
                      fontSize: 12,
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    Open Settings
                  </button>
                </div>
              )}
              {searchError && (
                <div style={{ fontSize: 12, fontFamily: T.monoFont, color: "#9B5C5C", marginTop: 8 }}>
                  {searchError}
                </div>
              )}
              {(synthesis || synthesisError || synthesizing) && (
                <div
                  className="rh-fade"
                  style={{
                    marginTop: 12,
                    padding: 14,
                    background: T.panel,
                    border: `1px solid ${synthesisError ? "rgba(155,92,92,0.4)" : T.accent}`,
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.monoFont,
                      fontSize: 10,
                      color: synthesisError ? "#9B5C5C" : T.accent,
                      textTransform: "uppercase",
                      letterSpacing: 1.5,
                      marginBottom: 6,
                    }}
                  >
                    {synthesisError
                      ? "Synthesis error"
                      : synthesizing
                      ? `Synthesis · ${prefs?.groqModel || "groq"}`
                      : `Synthesis · ${prefs?.groqModel || "groq"}`}
                  </div>
                  <div
                    style={{
                      fontFamily: T.font,
                      fontSize: 14,
                      color: synthesisError ? "#9B5C5C" : T.text,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {synthesisError || synthesis || "Generating…"}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {results.map((r) => {
                  const saved = savedKeys.has(`url:${r.url}`);
                  return (
                    <SourceCard
                      key={r.url}
                      title={r.title}
                      meta={r.url}
                      body={r.snippet}
                      saved={saved}
                      onSave={() => onSaveResult(r)}
                      onOpen={() => window.open(r.url, "_blank")}
                      onCapture={() =>
                        onCapture({
                          sourceTitle: r.title,
                          source: r.url,
                          quote: r.snippet || "",
                          tag: activeSession?.topic || "",
                        })
                      }
                    />
                  );
                })}
                {results.length === 0 && !searching && !searchError && hasSearchKey && (
                  <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.muted }}>
                    Run a search to see results here.
                  </div>
                )}
              </div>
            </section>

            {/* Clipped notes */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SectionHeader title={`Web Clipper · ${prefs?.clipperFolder || "(not set)"}`} />
                <button onClick={reloadClipped} style={{ ...buttonGhostStyle, padding: "4px 10px" }}>
                  Refresh
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {clipped.length === 0 && (
                  <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.muted }}>
                    Nothing clipped yet. Notes saved to{" "}
                    <code>{prefs?.clipperFolder}</code> by Obsidian Web Clipper will appear here.
                  </div>
                )}
                {clipped.map((n) => {
                  const saved = savedKeys.has(`path:${n.filePath}`);
                  return (
                    <SourceCard
                      key={n.filePath}
                      title={n.title}
                      meta={n.source || n.filePath}
                      body={n.excerpt}
                      saved={saved}
                      onSave={() => onAddClipped(n)}
                      onOpen={() => window.researchHub.books.revealInFinder(n.filePath)}
                      openLabel="Reveal"
                      onCapture={() =>
                        onCapture({
                          sourceTitle: n.title,
                          source: n.source || n.filePath,
                          quote: n.excerpt || "",
                          tag: activeSession?.topic || "",
                        })
                      }
                    />
                  );
                })}
              </div>
            </section>

            {/* Captures in this session */}
            <section>
              <SectionHeader title={`Captures · ${activeSession.captures.length}`} />
              {activeSession.captures.length === 0 ? (
                <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.muted }}>
                  Save search results or clipped notes to gather them here.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeSession.captures.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: 12,
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: T.font, fontSize: 14, color: T.text }}>
                          {c.title}
                        </div>
                        <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.subtext, marginTop: 2 }}>
                          {c.type} · {c.url || c.filePath || ""} · {timeAgo(c.addedAt)}
                        </div>
                        {c.snippet && (
                          <div style={{ fontSize: 13, color: T.text, marginTop: 6, opacity: 0.85 }}>
                            {c.snippet}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveCapture(activeSession.id, c.id)}
                        style={{ ...buttonGhostStyle, padding: "4px 10px" }}
                        title="Remove from session"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}

/* ─── Zotero tab ──────────────────────────────────────────────────────────── */
function ZoteroTab({ onCapture }) {
  const api = typeof window !== "undefined" ? window.researchHub : null;
  const [status, setStatus] = useState({ checked: false, ok: false, error: null });
  const [collections, setCollections] = useState([]);
  const [activeCollection, setActiveCollection] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState(null);
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteWriting, setNoteWriting] = useState(false);
  const [noteMessage, setNoteMessage] = useState(null);

  const checkConnection = useCallback(async () => {
    if (!api) return;
    const res = await api.zotero.ping();
    setStatus({ checked: true, ok: !!res.ok, error: res.error || null });
    if (res.ok) {
      const cres = await api.zotero.listCollections();
      if (cres.ok) setCollections(cres.collections);
    }
  }, [api]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const loadItems = useCallback(async () => {
    if (!api || !status.ok) return;
    setLoadingItems(true);
    setItemsError(null);
    const res = await api.zotero.listItems({
      collectionKey: activeCollection || undefined,
      query: query.trim() || undefined,
      limit: 50,
    });
    if (res.ok) setItems(res.items);
    else {
      setItems([]);
      setItemsError(res.error);
    }
    setLoadingItems(false);
  }, [api, status.ok, activeCollection, query]);

  useEffect(() => {
    if (status.ok) loadItems();
  }, [status.ok, activeCollection, loadItems]);

  const submitNote = async (itemKey) => {
    if (!api || !noteDraft.trim()) return;
    setNoteWriting(true);
    setNoteMessage(null);
    const res = await api.zotero.addNote(itemKey, noteDraft);
    setNoteWriting(false);
    if (res.ok) {
      setNoteMessage({ kind: "ok", text: "Note added to Zotero." });
      setNoteDraft("");
    } else {
      setNoteMessage({ kind: "err", text: res.error || "Failed." });
    }
  };

  const collectionsByParent = useMemo(() => {
    const map = new Map();
    for (const c of collections) {
      const parent = c.parentCollection || "__root__";
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent).push(c);
    }
    return map;
  }, [collections]);

  const renderCollectionTree = (parentKey, depth = 0) => {
    const children = collectionsByParent.get(parentKey) || [];
    return children.map((c) => {
      const active = activeCollection === c.key;
      const nested = collectionsByParent.has(c.key);
      return (
        <React.Fragment key={c.key}>
          <button
            onClick={() => setActiveCollection(active ? null : c.key)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: active ? T.surface : "transparent",
              border: `1px solid ${active ? T.border : "transparent"}`,
              borderRadius: 4,
              padding: `4px 8px 4px ${10 + depth * 12}px`,
              marginBottom: 2,
              color: active ? T.text : T.subtext,
              fontFamily: T.font,
              fontSize: 13,
              lineHeight: 1.3,
            }}
          >
            {c.name}
            <span style={{ color: T.muted, fontSize: 11, marginLeft: 6, fontFamily: T.monoFont }}>
              {c.numItems}
            </span>
          </button>
          {nested && renderCollectionTree(c.key, depth + 1)}
        </React.Fragment>
      );
    });
  };

  if (!status.checked) {
    return (
      <div style={{ padding: 40, fontFamily: T.monoFont, fontSize: 13, color: T.subtext }}>
        Connecting to Zotero…
      </div>
    );
  }

  if (!status.ok) {
    return (
      <div
        className="rh-fade"
        style={{
          padding: "60px 40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ fontFamily: T.font, fontSize: 22, color: T.text }}>
          Zotero isn't reachable
        </div>
        <div
          style={{
            fontFamily: T.monoFont,
            fontSize: 12,
            color: T.subtext,
            maxWidth: 460,
            lineHeight: 1.6,
          }}
        >
          {status.error || "Could not reach the local Zotero API."}
          <br />
          Open Zotero, then enable <em>Preferences → Advanced → Allow other applications on
          this computer to communicate with Zotero</em>.
        </div>
        <button onClick={checkConnection} style={buttonPrimaryStyle}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="rh-fade"
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 0,
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <aside
        style={{
          borderRight: `1px solid ${T.border}`,
          padding: "20px 12px",
          background: T.bg2,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: T.monoFont,
            fontSize: 11,
            color: T.subtext,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            marginBottom: 10,
          }}
        >
          Collections
        </div>
        <button
          onClick={() => setActiveCollection(null)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: !activeCollection ? T.surface : "transparent",
            border: `1px solid ${!activeCollection ? T.border : "transparent"}`,
            borderRadius: 4,
            padding: "5px 10px",
            marginBottom: 6,
            color: !activeCollection ? T.text : T.subtext,
            fontFamily: T.font,
            fontSize: 13,
          }}
        >
          All items
        </button>
        {renderCollectionTree("__root__")}
      </aside>

      <section style={{ padding: "24px 28px 60px", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadItems()}
            placeholder="Search title / creator / year…"
            style={{ ...inputStyle, fontSize: 13, flex: 1 }}
          />
          <button onClick={loadItems} disabled={loadingItems} style={buttonGhostStyle}>
            {loadingItems ? "…" : "Search"}
          </button>
          <button onClick={checkConnection} style={buttonGhostStyle} title="Re-check connection + reload collections">
            ↻
          </button>
        </div>

        {itemsError && (
          <div style={{ fontFamily: T.monoFont, fontSize: 12, color: "#9B5C5C", marginBottom: 12 }}>
            {itemsError}
          </div>
        )}

        {items.length === 0 && !loadingItems && !itemsError && (
          <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.muted, padding: 20 }}>
            No items.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => {
            const expanded = expandedKey === item.key;
            const creators = item.creators.slice(0, 3).join("; ");
            const more = item.creators.length > 3 ? ` +${item.creators.length - 3}` : "";
            return (
              <div
                key={item.key}
                className="rh-card"
                style={{
                  background: T.surface,
                  border: `1px solid ${expanded ? T.accent : T.border}`,
                  borderRadius: 4,
                  padding: 12,
                }}
              >
                <div
                  onClick={() => {
                    setExpandedKey(expanded ? null : item.key);
                    setNoteDraft("");
                    setNoteMessage(null);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ fontFamily: T.font, fontSize: 15, color: T.text, lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontFamily: T.monoFont,
                      fontSize: 11,
                      color: T.subtext,
                      marginTop: 3,
                    }}
                  >
                    {creators}
                    {more}
                    {item.year && ` · ${item.year}`}
                    {item.itemType && ` · ${item.itemType}`}
                  </div>
                </div>

                {expanded && (
                  <div className="rh-fade" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                    {item.abstractNote && (
                      <div
                        style={{
                          fontSize: 13,
                          color: T.text,
                          lineHeight: 1.5,
                          marginBottom: 10,
                          opacity: 0.9,
                        }}
                      >
                        {item.abstractNote}
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 10, fontFamily: T.monoFont, fontSize: 11 }}>
                      {item.url && (
                        <a
                          href={item.url}
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(item.url, "_blank");
                          }}
                          style={{ color: T.accent }}
                        >
                          URL
                        </a>
                      )}
                      {item.DOI && (
                        <a
                          href={`https://doi.org/${item.DOI}`}
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(`https://doi.org/${item.DOI}`, "_blank");
                          }}
                          style={{ color: T.accent }}
                        >
                          DOI: {item.DOI}
                        </a>
                      )}
                      {item.tags.length > 0 && (
                        <span style={{ color: T.muted }}>tags: {item.tags.slice(0, 6).join(", ")}</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <button
                        onClick={() =>
                          onCapture({
                            sourceTitle:
                              item.title + (item.year ? ` (${item.year})` : ""),
                            source: `zotero://select/library/items/${item.key}`,
                            quote: item.abstractNote || "",
                            note: item.creators.length ? `By ${item.creators.join("; ")}` : "",
                          })
                        }
                        style={buttonPrimaryStyle}
                      >
                        Capture
                      </button>
                      <button
                        onClick={() => window.open(`zotero://select/library/items/${item.key}`, "_blank")}
                        style={buttonGhostStyle}
                      >
                        Open in Zotero
                      </button>
                    </div>

                    <div>
                      <div
                        style={{
                          fontFamily: T.monoFont,
                          fontSize: 10,
                          color: T.subtext,
                          textTransform: "uppercase",
                          letterSpacing: 1.2,
                          marginBottom: 6,
                        }}
                      >
                        Add note to this item
                      </div>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={3}
                        placeholder="Write a note…"
                        style={{ ...inputStyle, fontFamily: T.font, fontSize: 13, lineHeight: 1.5 }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        {noteMessage ? (
                          <div
                            style={{
                              fontFamily: T.monoFont,
                              fontSize: 11,
                              color: noteMessage.kind === "ok" ? "#6BAA75" : "#9B5C5C",
                            }}
                          >
                            {noteMessage.kind === "ok" ? "✓ " : ""}{noteMessage.text}
                          </div>
                        ) : (
                          <span />
                        )}
                        <button
                          onClick={() => submitNote(item.key)}
                          disabled={noteWriting || !noteDraft.trim()}
                          style={{
                            ...buttonGhostStyle,
                            color: T.accent,
                            borderColor: "rgba(196,168,130,0.4)",
                            opacity: noteWriting || !noteDraft.trim() ? 0.4 : 1,
                          }}
                        >
                          {noteWriting ? "Saving…" : "Save note"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─── Capture panel ───────────────────────────────────────────────────────── */
function CapturePanel({ open, prefill, onClose, onWrite, prefs, tags, reloadTags }) {
  const [quote, setQuote] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [source, setSource] = useState("");
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const [addDaily, setAddDaily] = useState(false);
  const [writing, setWriting] = useState(false);
  const [okMessage, setOkMessage] = useState(null);
  const [error, setError] = useState(null);
  const quoteRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuote(prefill?.quote ?? "");
    setSourceTitle(prefill?.sourceTitle ?? "");
    setSource(prefill?.source ?? "");
    setTag(prefill?.tag ?? "");
    setNote(prefill?.note ?? "");
    setAddDaily(prefs?.dailyNoteIntegration || false);
    setOkMessage(null);
    setError(null);
    reloadTags?.();
    const t = setTimeout(() => quoteRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, prefill, prefs?.dailyNoteIntegration, reloadTags]);

  const filteredTags = useMemo(() => {
    if (!tag.trim()) return tags.slice(0, 6);
    const lower = tag.toLowerCase();
    return tags.filter((t) => t.toLowerCase().includes(lower) && t !== tag).slice(0, 6);
  }, [tag, tags]);

  if (!open) return null;

  const submit = async () => {
    if (!quote.trim() && !note.trim()) {
      setError("Add a quote or a note.");
      return;
    }
    if (!tag.trim()) {
      setError("Pick a tag — captures land in <vault>/Research Hub/captures/<tag>.md.");
      return;
    }
    setWriting(true);
    setError(null);
    setOkMessage(null);
    const res = await onWrite({
      quote,
      sourceTitle,
      source,
      tag: tag.trim(),
      note,
      addDailyNote: addDaily,
    });
    setWriting(false);
    if (res.ok) {
      setOkMessage(
        res.dailyNotePath
          ? "Saved to vault + daily note."
          : "Saved to vault.",
      );
      setQuote("");
      setNote("");
      setTimeout(() => quoteRef.current?.focus(), 30);
    } else {
      setError(res.error);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        className="rh-fade"
        style={{
          width: 460,
          maxWidth: "100vw",
          height: "100vh",
          background: T.panel,
          borderLeft: `1px solid ${T.border}`,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: T.font, fontSize: 18, color: T.text }}>Capture</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: T.monoFont, fontSize: 10, color: T.muted }}>
              ⌘⇧C · esc to close
            </span>
            <button onClick={onClose} style={{ ...buttonGhostStyle, padding: "4px 10px" }}>
              ✕
            </button>
          </div>
        </div>

        <Field label="Quote / excerpt">
          <textarea
            ref={quoteRef}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={5}
            placeholder="Paste a passage…"
            style={{ ...inputStyle, fontFamily: T.font, fontSize: 14, lineHeight: 1.5 }}
          />
        </Field>

        <Field label="Source title">
          <input
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="e.g. Edward Elgar — Wikipedia"
            style={inputStyle}
          />
        </Field>

        <Field label="Source URL or Zotero key">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://… or zotero://select/…"
            style={inputStyle}
          />
        </Field>

        <Field label="Tag">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="elgar"
            style={inputStyle}
          />
          {filteredTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {filteredTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    borderRadius: 999,
                    padding: "2px 9px",
                    color: T.subtext,
                    fontSize: 11,
                    fontFamily: T.monoFont,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Note (optional)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why this matters / where it connects…"
            style={{ ...inputStyle, fontFamily: T.font, fontSize: 13, lineHeight: 1.5 }}
          />
        </Field>

        {prefs?.dailyNoteFolder && (
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontFamily: T.monoFont,
              fontSize: 12,
              color: T.subtext,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={addDaily}
              onChange={(e) => setAddDaily(e.target.checked)}
            />
            Also log to today's daily note ({prefs.dailyNoteFolder})
          </label>
        )}

        {error && (
          <div style={{ fontFamily: T.monoFont, fontSize: 12, color: "#9B5C5C" }}>
            {error}
          </div>
        )}
        {okMessage && (
          <div style={{ fontFamily: T.monoFont, fontSize: 12, color: "#6BAA75" }}>
            ✓ {okMessage}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "auto" }}>
          <button onClick={onClose} style={buttonGhostStyle}>
            Close
          </button>
          <button
            onClick={submit}
            disabled={writing || !tag.trim() || (!quote.trim() && !note.trim())}
            style={{
              ...buttonPrimaryStyle,
              opacity:
                writing || !tag.trim() || (!quote.trim() && !note.trim()) ? 0.4 : 1,
            }}
          >
            {writing ? "Saving…" : "Write to vault"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <h2
      style={{
        fontFamily: T.font,
        fontSize: 14,
        color: T.subtext,
        textTransform: "uppercase",
        letterSpacing: 2,
        fontWeight: "normal",
        marginBottom: 12,
        paddingBottom: 6,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {title}
    </h2>
  );
}

function SourceCard({ title, meta, body, saved, onSave, onOpen, onCapture, openLabel = "Open" }) {
  return (
    <div
      className="rh-card"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        padding: 12,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          onClick={onOpen}
          style={{
            fontFamily: T.font,
            fontSize: 15,
            color: T.text,
            cursor: "pointer",
            lineHeight: 1.3,
          }}
          title={openLabel}
        >
          {title}
        </div>
        {meta && (
          <div
            style={{
              fontFamily: T.monoFont,
              fontSize: 11,
              color: T.subtext,
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {meta}
          </div>
        )}
        {body && (
          <div style={{ fontSize: 12, color: T.subtext, marginTop: 6, lineHeight: 1.45 }}>
            {body}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
        <button
          onClick={onSave}
          disabled={saved}
          style={{
            ...(saved ? buttonGhostStyle : buttonPrimaryStyle),
            padding: "5px 12px",
            opacity: saved ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
        {onCapture && (
          <button
            onClick={onCapture}
            title="Capture into vault"
            style={{
              ...buttonGhostStyle,
              color: T.accent,
              borderColor: "rgba(196,168,130,0.4)",
              padding: "5px 12px",
              whiteSpace: "nowrap",
            }}
          >
            Capture
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── App shell ───────────────────────────────────────────────────────────── */
export default function ResearchHub() {
  const api = typeof window !== "undefined" ? window.researchHub : null;

  const [tab, setTab] = useState("books");
  const [prefs, setPrefsState] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [clipped, setClipped] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturePrefill, setCapturePrefill] = useState(null);
  const [tags, setTags] = useState([]);

  const loadPrefs = useCallback(async () => {
    if (!api) return;
    const p = await api.prefs.get();
    setPrefsState(p);
  }, [api]);

  const loadBooks = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    const res = await api.books.list();
    if (res.ok) {
      setBooks(res.books);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    if (prefs && prefs.vaultPath) loadBooks();
  }, [prefs, loadBooks]);

  const pickVault = useCallback(async () => {
    if (!api) return;
    const p = await api.prefs.pickVault();
    if (p) setPrefsState(p);
  }, [api]);

  const handleCycleStatus = useCallback(
    async (book) => {
      if (!api) return;
      const target = nextStatus(book.status || "toread");
      const res = await api.books.updateStatus(book.filePath, target);
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) => (b.filePath === book.filePath ? res.book : b)),
        );
      } else {
        setError(res.error);
      }
    },
    [api],
  );

  const handleRate = useCallback(
    async (book, rating) => {
      if (!api) return;
      const res = await api.books.updateRating(book.filePath, rating);
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) => (b.filePath === book.filePath ? res.book : b)),
        );
      } else {
        setError(res.error);
      }
    },
    [api],
  );

  const handleStart = useCallback(
    async (book) => {
      if (!api) return;
      const res = await api.books.updateStatus(book.filePath, "inprogress");
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) => (b.filePath === book.filePath ? res.book : b)),
        );
      } else {
        setError(res.error);
      }
    },
    [api],
  );

  const handleReveal = useCallback(
    (book) => {
      if (!api) return;
      api.books.revealInFinder(book.filePath);
    },
    [api],
  );

  const loadSessions = useCallback(async () => {
    if (!api) return;
    const list = await api.sessions.list();
    setSessions(Array.isArray(list) ? list : []);
  }, [api]);

  const loadClipped = useCallback(async () => {
    if (!api) return;
    const res = await api.clipper.list();
    if (res?.ok) setClipped(res.notes);
    else setClipped([]);
  }, [api]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (prefs?.vaultPath) loadClipped();
  }, [prefs?.vaultPath, prefs?.clipperFolder, loadClipped]);

  useEffect(() => {
    if (!api) return;
    const off = api.clipper.onNew(async (_note) => {
      loadClipped();
    });
    const offRm = api.clipper.onRemoved(() => {
      loadClipped();
    });
    return () => {
      off?.();
      offRm?.();
    };
  }, [api, loadClipped]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === prefs?.activeSessionId) ?? null,
    [sessions, prefs?.activeSessionId],
  );

  const handleCreateSession = useCallback(
    async (name, topic) => {
      if (!api) return;
      await api.sessions.create(name, topic);
      const [list, p] = await Promise.all([api.sessions.list(), api.prefs.get()]);
      setSessions(list);
      setPrefsState(p);
    },
    [api],
  );

  const handleSelectSession = useCallback(
    async (id) => {
      if (!api) return;
      await api.sessions.setActive(id);
      const p = await api.prefs.get();
      setPrefsState(p);
    },
    [api],
  );

  const handleRenameSession = useCallback(
    async (id, name, topic) => {
      if (!api) return;
      await api.sessions.rename(id, name, topic);
      const list = await api.sessions.list();
      setSessions(list);
    },
    [api],
  );

  const handleDeleteSession = useCallback(
    async (id) => {
      if (!api) return;
      await api.sessions.delete(id);
      const [list, p] = await Promise.all([api.sessions.list(), api.prefs.get()]);
      setSessions(list);
      setPrefsState(p);
    },
    [api],
  );

  const handleSearch = useCallback(
    async (query) => {
      if (!api) return { ok: false, error: "Bridge unavailable" };
      return api.search.run(query);
    },
    [api],
  );

  const handleSynthesize = useCallback(
    async (query, topic, results) => {
      if (!api) return { ok: false, error: "Bridge unavailable" };
      return api.synthesis.run(query, topic, results);
    },
    [api],
  );

  const handleSaveResult = useCallback(
    async (result) => {
      if (!api || !activeSession) return;
      const updated = await api.sessions.addCapture(activeSession.id, {
        type: "search",
        title: result.title,
        url: result.url,
        snippet: result.snippet,
      });
      if (updated) {
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
    },
    [api, activeSession],
  );

  const handleAddClipped = useCallback(
    async (note) => {
      if (!api || !activeSession) return;
      const updated = await api.sessions.addCapture(activeSession.id, {
        type: "clipped",
        title: note.title,
        url: note.source,
        snippet: note.excerpt,
        filePath: note.filePath,
      });
      if (updated) {
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
    },
    [api, activeSession],
  );

  const handleRemoveCapture = useCallback(
    async (sessionId, captureId) => {
      if (!api) return;
      const updated = await api.sessions.removeCapture(sessionId, captureId);
      if (updated) {
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
    },
    [api],
  );

  const handleSaveSettings = useCallback(
    async (patch) => {
      if (!api) return;
      const next = await api.prefs.set(patch);
      setPrefsState(next);
      loadClipped();
    },
    [api, loadClipped],
  );

  const loadTags = useCallback(async () => {
    if (!api) return;
    const list = await api.tags.list();
    setTags(Array.isArray(list) ? list : []);
  }, [api]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const openCapture = useCallback(
    (prefill = null) => {
      const sessionTopic = sessions.find((s) => s.id === prefs?.activeSessionId)?.topic || "";
      const fallbackTag = sessionTopic || prefs?.lastTag || "";
      const resolved = {
        ...(prefill || {}),
        tag: (prefill?.tag && prefill.tag.trim()) || fallbackTag,
      };
      setCapturePrefill(resolved);
      setCaptureOpen(true);
    },
    [sessions, prefs?.activeSessionId, prefs?.lastTag],
  );

  const handleWriteCapture = useCallback(
    async (payload) => {
      if (!api) return { ok: false, error: "Bridge unavailable" };
      const res = await api.captures.write(payload);
      if (res.ok) loadTags();
      return res;
    },
    [api, loadTags],
  );

  useEffect(() => {
    const handler = (e) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        if (captureOpen) {
          setCaptureOpen(false);
        } else {
          openCapture(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [captureOpen, openCapture]);

  const vaultLabel = prefs?.vaultPath
    ? prefs.vaultPath.split("/").filter(Boolean).slice(-1)[0] || prefs.vaultPath
    : null;

  const tabs = [
    { key: "books", label: "Books" },
    { key: "research", label: "Research" },
    { key: "zotero", label: "Zotero" },
  ];

  const noVault = !prefs?.vaultPath;

  return (
    <>
      <style>{CSS}</style>
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          color: T.text,
          fontFamily: T.font,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px 12px",
            borderBottom: `1px solid ${T.border}`,
            background: T.bg2,
            WebkitAppRegion: "drag",
            paddingLeft: 88,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ fontFamily: T.font, fontSize: 18, color: T.text, letterSpacing: 1 }}>
              Research Hub
            </div>
            <nav style={{ display: "flex", gap: 4, WebkitAppRegion: "no-drag" }}>
              {tabs.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      background: active ? T.surface : "transparent",
                      color: active ? T.text : T.subtext,
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 14px",
                      fontSize: 13,
                      fontFamily: T.monoFont,
                      letterSpacing: 0.5,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: T.monoFont,
              fontSize: 11,
              color: T.subtext,
              WebkitAppRegion: "no-drag",
            }}
          >
            {vaultLabel && (
              <span title={prefs.vaultPath} style={{ opacity: 0.8 }}>
                vault · {vaultLabel}
              </span>
            )}
            <button
              onClick={pickVault}
              style={{
                background: "transparent",
                color: T.subtext,
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                padding: "4px 10px",
                fontSize: 11,
                fontFamily: T.monoFont,
                letterSpacing: 0.5,
              }}
            >
              {vaultLabel ? "Change" : "Choose vault"}
            </button>
            {!noVault && tab === "books" && (
              <button
                onClick={loadBooks}
                disabled={loading}
                style={{
                  background: "transparent",
                  color: T.subtext,
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontFamily: T.monoFont,
                  letterSpacing: 0.5,
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? "…" : "Reload"}
              </button>
            )}
            {!noVault && (
              <button
                onClick={() => openCapture(null)}
                title="Capture (⌘⇧C)"
                style={{
                  background: T.accent,
                  color: T.accentText,
                  border: "none",
                  borderRadius: 3,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontFamily: T.monoFont,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Capture
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                background: "transparent",
                color: T.subtext,
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                padding: "4px 10px",
                fontSize: 11,
                fontFamily: T.monoFont,
                letterSpacing: 0.5,
              }}
            >
              Settings
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto" }}>
          {noVault && <VaultEmptyState onPick={pickVault} />}
          {!noVault && tab === "books" && (
            <BooksTab
              books={books}
              loading={loading}
              error={error}
              onCycleStatus={handleCycleStatus}
              onRate={handleRate}
              onStart={handleStart}
              onReveal={handleReveal}
              onReload={loadBooks}
            />
          )}
          {!noVault && tab === "research" && (
            <ResearchTab
              sessions={sessions}
              activeSession={activeSession}
              onCreateSession={handleCreateSession}
              onSelectSession={handleSelectSession}
              onRenameSession={handleRenameSession}
              onDeleteSession={handleDeleteSession}
              onSearch={handleSearch}
              onSynthesize={handleSynthesize}
              onSaveResult={handleSaveResult}
              onAddClipped={handleAddClipped}
              onRemoveCapture={handleRemoveCapture}
              onCapture={openCapture}
              clipped={clipped}
              reloadClipped={loadClipped}
              prefs={prefs}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {!noVault && tab === "zotero" && <ZoteroTab onCapture={openCapture} />}
        </main>
        {settingsOpen && (
          <SettingsPopover
            prefs={prefs}
            onSave={handleSaveSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        <CapturePanel
          open={captureOpen}
          prefill={capturePrefill}
          prefs={prefs}
          tags={tags}
          reloadTags={loadTags}
          onWrite={handleWriteCapture}
          onClose={() => setCaptureOpen(false)}
        />
      </div>
    </>
  );
}
