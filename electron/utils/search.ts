import { getPrefs } from "./store";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface TavilyResultItem {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResultItem[];
  detail?: unknown;
}

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export async function runWebSearch(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { tavilyApiKey } = getPrefs();
  if (!tavilyApiKey) {
    throw new Error("Tavily API key not set. Add it in Settings.");
  }

  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tavilyApiKey}`,
    },
    body: JSON.stringify({
      query: trimmed,
      search_depth: "basic",
      max_results: 10,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) {
        msg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {}
    throw new Error(`Tavily ${res.status}: ${msg || res.statusText}`);
  }

  const data = (await res.json()) as TavilyResponse;
  const items = data.results ?? [];
  return items
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: String(r.title),
      url: String(r.url),
      snippet: String(r.content ?? ""),
    }));
}
