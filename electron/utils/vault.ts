import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type BookStatus = "toread" | "inprogress" | "completed" | "dnf";

export interface Book {
  filePath: string;
  title: string;
  author: string;
  genre: string;
  publisher: string;
  publishDate: string;
  image: string;
  status: BookStatus | "";
  totalPage: number | null;
  startDate: string;
  finishDate: string;
  myRate: number | null;
  created: string;
  updated: string;
}

const SKIP_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

async function walkMarkdown(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

function isBookFrontmatter(data: Record<string, any>): boolean {
  const tags = data.tags;
  if (Array.isArray(tags)) {
    if (tags.some((t) => typeof t === "string" && t.replace(/^#/, "") === "book")) return true;
  } else if (typeof tags === "string") {
    if (tags.replace(/^#/, "") === "book") return true;
  }
  const source = data.Source;
  if (Array.isArray(source)) {
    if (source.some((s) => typeof s === "string" && s.toLowerCase() === "book")) return true;
  } else if (typeof source === "string") {
    if (source.toLowerCase() === "book") return true;
  }
  return false;
}

function normalizeStatus(value: unknown): BookStatus | "" {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase().replace(/\s+/g, "");
  if (v === "toread" || v === "inprogress" || v === "completed" || v === "dnf") {
    return v as BookStatus;
  }
  return "";
}

function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBook(filePath: string, data: Record<string, any>): Book {
  return {
    filePath,
    title: str(data.Title) || path.basename(filePath, ".md"),
    author: str(data.Author),
    genre: str(data.Genre) || "Uncategorized",
    publisher: str(data.Publisher),
    publishDate: str(data.Publish_Date),
    image: str(data.Image),
    status: normalizeStatus(data.Status),
    totalPage: num(data.Total_page),
    startDate: str(data.Start_date),
    finishDate: str(data.Finish_date),
    myRate: num(data.My_rate),
    created: str(data.created),
    updated: str(data.updated),
  };
}

export async function listBooks(vaultPath: string): Promise<Book[]> {
  if (!vaultPath) return [];
  let exists = false;
  try {
    const st = await fs.stat(vaultPath);
    exists = st.isDirectory();
  } catch {
    exists = false;
  }
  if (!exists) return [];

  const files = await walkMarkdown(vaultPath);
  const books: Book[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = matter(raw);
      if (!isBookFrontmatter(parsed.data)) continue;
      books.push(toBook(file, parsed.data));
    } catch {
      // Skip unreadable / malformed files silently — vault crawls must be resilient.
    }
  }
  return books;
}

const WRITABLE_FIELDS = new Set(["Status", "Start_date", "Finish_date", "My_rate"]);

export interface UpdateBookFields {
  Status?: BookStatus;
  Start_date?: string;
  Finish_date?: string;
  My_rate?: number | null;
}

export async function updateBookFrontmatter(
  filePath: string,
  fields: UpdateBookFields,
): Promise<Book> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  if (!isBookFrontmatter(parsed.data)) {
    throw new Error(`Refusing to write: ${filePath} no longer matches book filter`);
  }
  const next = { ...parsed.data };
  for (const [key, value] of Object.entries(fields)) {
    if (!WRITABLE_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    next[key] = value;
  }
  const rebuilt = matter.stringify(parsed.content, next);
  await fs.writeFile(filePath, rebuilt, "utf8");
  return toBook(filePath, next);
}

export function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
