import { randomUUID } from "node:crypto";
import { getStoreValue, setStoreValue, getPrefs, setPrefs } from "./store";

export interface Capture {
  id: string;
  type: "search" | "clipped" | "note";
  title: string;
  url?: string;
  snippet?: string;
  filePath?: string;
  note?: string;
  addedAt: string;
}

export interface Session {
  id: string;
  name: string;
  topic: string;
  captures: Capture[];
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function loadAll(): Session[] {
  const raw = getStoreValue("rh_sessions");
  return Array.isArray(raw) ? (raw as Session[]) : [];
}

function saveAll(sessions: Session[]): void {
  setStoreValue("rh_sessions", sessions);
}

export function listSessions(): Session[] {
  return [...loadAll()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createSession(name: string, topic: string): Session {
  const trimmedName = (name || "").trim() || "Untitled session";
  const session: Session = {
    id: randomUUID(),
    name: trimmedName,
    topic: (topic || "").trim(),
    captures: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const all = loadAll();
  all.push(session);
  saveAll(all);
  setPrefs({ activeSessionId: session.id });
  return session;
}

export function renameSession(id: string, name: string, topic: string): Session | null {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    name: (name || "").trim() || all[idx].name,
    topic: (topic ?? all[idx].topic).trim(),
    updatedAt: nowIso(),
  };
  saveAll(all);
  return all[idx];
}

export function deleteSession(id: string): void {
  const all = loadAll().filter((s) => s.id !== id);
  saveAll(all);
  const prefs = getPrefs();
  if (prefs.activeSessionId === id) {
    setPrefs({ activeSessionId: all[0]?.id ?? "" });
  }
}

export function addCapture(sessionId: string, capture: Omit<Capture, "id" | "addedAt">): Session | null {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;
  const full: Capture = {
    ...capture,
    id: randomUUID(),
    addedAt: nowIso(),
  };
  all[idx] = {
    ...all[idx],
    captures: [full, ...all[idx].captures],
    updatedAt: nowIso(),
  };
  saveAll(all);
  return all[idx];
}

export function removeCapture(sessionId: string, captureId: string): Session | null {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    captures: all[idx].captures.filter((c) => c.id !== captureId),
    updatedAt: nowIso(),
  };
  saveAll(all);
  return all[idx];
}

export function setActiveSession(id: string): void {
  setPrefs({ activeSessionId: id });
}

export function getActiveSession(): Session | null {
  const prefs = getPrefs();
  if (!prefs.activeSessionId) return null;
  return loadAll().find((s) => s.id === prefs.activeSessionId) ?? null;
}
