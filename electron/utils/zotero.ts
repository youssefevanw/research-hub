import { getPrefs } from "./store";

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection: string | false;
  numItems: number;
}

export interface ZoteroItem {
  key: string;
  title: string;
  creators: string[];
  year: string;
  itemType: string;
  url: string;
  DOI: string;
  abstractNote: string;
  tags: string[];
  collections: string[];
}

export interface ZoteroPingResult {
  ok: boolean;
  error?: string;
  version?: string;
}

function base(): string {
  const { zoteroPort } = getPrefs();
  const port = zoteroPort && Number.isFinite(zoteroPort) ? zoteroPort : 23119;
  return `http://localhost:${port}/api/users/0`;
}

async function zfetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Zotero-API-Version": "3",
    Accept: "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${base()}${path}`, { ...init, headers });
}

export async function ping(): Promise<ZoteroPingResult> {
  const { zoteroPort } = getPrefs();
  const port = zoteroPort && Number.isFinite(zoteroPort) ? zoteroPort : 23119;
  try {
    const res = await fetch(`${base()}/items?limit=1`, {
      headers: { "Zotero-API-Version": "3" },
    });
    if (res.ok) {
      const version = res.headers.get("Last-Modified-Version") ?? undefined;
      return { ok: true, version };
    }
    if (res.status === 404) {
      try {
        const connector = await fetch(`http://localhost:${port}/connector/ping`);
        if (connector.ok) {
          return {
            ok: false,
            error:
              "Zotero is running, but the local data API isn't exposed. Requires Zotero 7+ with Preferences → Advanced → 'Allow other applications on this computer to communicate with Zotero' enabled (and the data API toggle if your version separates it).",
          };
        }
      } catch {}
      return { ok: false, error: `Zotero data API not found at port ${port} (404).` };
    }
    return { ok: false, error: `Zotero responded ${res.status}` };
  } catch (e: any) {
    return {
      ok: false,
      error:
        e?.code === "ECONNREFUSED"
          ? "Zotero not running. Open Zotero, then enable the local API in Preferences → Advanced."
          : e?.message ?? String(e),
    };
  }
}

function formatCreators(creators: any): string[] {
  if (!Array.isArray(creators)) return [];
  return creators
    .map((c) => {
      if (c?.name) return String(c.name);
      const last = c?.lastName ? String(c.lastName) : "";
      const first = c?.firstName ? String(c.firstName) : "";
      if (last && first) return `${last}, ${first}`;
      return last || first;
    })
    .filter(Boolean);
}

function normalizeItem(raw: any): ZoteroItem {
  const data = raw?.data ?? raw ?? {};
  const yearMatch = typeof data.date === "string" ? data.date.match(/\d{4}/) : null;
  return {
    key: raw?.key ?? data.key ?? "",
    title: data.title || data.shortTitle || "(no title)",
    creators: formatCreators(data.creators),
    year: yearMatch ? yearMatch[0] : "",
    itemType: data.itemType || "",
    url: data.url || "",
    DOI: data.DOI || "",
    abstractNote: data.abstractNote || "",
    tags: Array.isArray(data.tags) ? data.tags.map((t: any) => String(t?.tag ?? "")).filter(Boolean) : [],
    collections: Array.isArray(data.collections) ? data.collections : [],
  };
}

export async function listCollections(): Promise<ZoteroCollection[]> {
  const res = await zfetch(`/collections?limit=200`);
  if (!res.ok) throw new Error(`Zotero ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((c: any) => ({
      key: c?.key ?? "",
      name: c?.data?.name || "(untitled)",
      parentCollection: c?.data?.parentCollection ?? false,
      numItems: c?.meta?.numItems ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ListItemsOpts {
  collectionKey?: string;
  tag?: string;
  query?: string;
  limit?: number;
}

export async function listItems(opts: ListItemsOpts = {}): Promise<ZoteroItem[]> {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 50));
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.query) {
    params.set("q", opts.query);
    params.set("qmode", "titleCreatorYear");
  }
  const path = opts.collectionKey
    ? `/collections/${opts.collectionKey}/items/top?${params.toString()}`
    : `/items/top?${params.toString()}`;
  const res = await zfetch(path);
  if (!res.ok) throw new Error(`Zotero ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeItem);
}

export async function addNote(parentItemKey: string, plainText: string): Promise<{ ok: boolean; error?: string }> {
  if (!parentItemKey) return { ok: false, error: "Missing item key" };
  if (!plainText.trim()) return { ok: false, error: "Note is empty." };

  const html = plainText
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const body = [
    {
      itemType: "note",
      parentItem: parentItemKey,
      note: html,
      tags: [],
      collections: [],
      relations: {},
    },
  ];

  const res = await zfetch(`/items`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error:
        res.status === 405 || res.status === 403
          ? "Zotero rejected the write. Local-API writes require Zotero 7."
          : `Zotero ${res.status}: ${text.slice(0, 200) || res.statusText}`,
    };
  }
  const data = await res.json().catch(() => null);
  if (data?.failed && Object.keys(data.failed).length > 0) {
    const firstFail = (data.failed as Record<string, any>)["0"];
    return { ok: false, error: firstFail?.message || "Zotero rejected note." };
  }
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
