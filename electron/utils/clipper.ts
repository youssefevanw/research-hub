import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import matter from "gray-matter";
import { BrowserWindow } from "electron";
import { getPrefs } from "./store";

export interface ClippedNote {
  filePath: string;
  title: string;
  source: string;
  excerpt: string;
  mtime: number;
}

function pickTitle(data: Record<string, any>, content: string, fallback: string): string {
  if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
  if (typeof data.Title === "string" && data.Title.trim()) return data.Title.trim();
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return fallback;
}

function pickSource(data: Record<string, any>): string {
  for (const key of ["source", "Source", "url", "URL", "link", "Link"]) {
    const v = data[key];
    if (typeof v === "string" && v.startsWith("http")) return v;
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === "string" && x.startsWith("http"));
      if (first) return first;
    }
  }
  return "";
}

function pickExcerpt(data: Record<string, any>, content: string): string {
  if (typeof data.excerpt === "string" && data.excerpt.trim()) return data.excerpt.trim();
  const body = content.replace(/^#+\s+.*$/gm, "").trim();
  return body.split(/\n\s*\n/)[0]?.slice(0, 240) ?? "";
}

async function readClipped(filePath: string): Promise<ClippedNote | null> {
  try {
    const [raw, stat] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      fs.stat(filePath),
    ]);
    const parsed = matter(raw);
    const fallback = path.basename(filePath, ".md");
    return {
      filePath,
      title: pickTitle(parsed.data, parsed.content, fallback),
      source: pickSource(parsed.data),
      excerpt: pickExcerpt(parsed.data, parsed.content),
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

function clipperDir(): string | null {
  const { vaultPath, clipperFolder } = getPrefs();
  if (!vaultPath || !clipperFolder) return null;
  return path.join(vaultPath, clipperFolder);
}

export async function listClippedNotes(): Promise<ClippedNote[]> {
  const dir = clipperDir();
  if (!dir) return [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const mdFiles = entries
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((f) => path.join(dir, f));
  const notes = await Promise.all(mdFiles.map(readClipped));
  return notes
    .filter((n): n is ClippedNote => n !== null)
    .sort((a, b) => b.mtime - a.mtime);
}

let watcher: FSWatcher | null = null;
let watchedDir: string | null = null;
let ready = false;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export async function startClipperWatcher(): Promise<void> {
  const dir = clipperDir();
  if (dir === watchedDir && watcher) return;

  await stopClipperWatcher();
  if (!dir) return;

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // If we can't create it, watching will silently no-op until prefs change.
  }

  ready = false;
  watcher = chokidar.watch(dir, {
    ignored: (p: string) => path.basename(p).startsWith("."),
    persistent: true,
    ignoreInitial: false,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 80 },
  });
  watchedDir = dir;

  watcher.on("ready", () => {
    ready = true;
  });

  watcher.on("add", async (filePath: string) => {
    if (!filePath.toLowerCase().endsWith(".md")) return;
    const note = await readClipped(filePath);
    if (!note) return;
    if (ready) broadcast("clipper:new", note);
  });

  watcher.on("unlink", (filePath: string) => {
    broadcast("clipper:removed", { filePath });
  });

  watcher.on("error", (err) => {
    console.warn("[research-hub] clipper watcher error", err);
  });
}

export async function stopClipperWatcher(): Promise<void> {
  if (watcher) {
    try {
      await watcher.close();
    } catch {}
    watcher = null;
  }
  watchedDir = null;
  ready = false;
}

export async function restartClipperWatcher(): Promise<void> {
  await stopClipperWatcher();
  await startClipperWatcher();
}
