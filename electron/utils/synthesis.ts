import { getPrefs } from "./store";
import type { SearchResult } from "./search";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface GroqChoice {
  message?: { content?: string };
  finish_reason?: string;
}

interface GroqResponse {
  choices?: GroqChoice[];
  error?: { message?: string };
}

function buildPrompt(query: string, topic: string, results: SearchResult[]): string {
  const trimmedResults = results.slice(0, 10).map((r, i) => {
    const snippet = (r.snippet || "").replace(/\s+/g, " ").trim().slice(0, 400);
    return `[${i + 1}] ${r.title}\n${r.url}\n${snippet}`;
  });
  const contextLines = [];
  if (topic) contextLines.push(`Active research topic: ${topic}`);
  contextLines.push(`Search query: ${query}`);
  return [
    contextLines.join("\n"),
    "",
    "Sources:",
    trimmedResults.join("\n\n"),
    "",
    "Write a single concise paragraph (3-5 sentences) synthesizing what these sources collectively say about the query. Cite source numbers inline like [1], [3]. If sources disagree, note the disagreement briefly. Do not add headings or bullet points.",
  ].join("\n");
}

export async function runSynthesis(
  query: string,
  topic: string,
  results: SearchResult[],
): Promise<string> {
  if (!query.trim()) throw new Error("Query is empty.");
  if (results.length === 0) throw new Error("No results to synthesize.");

  const { groqApiKey, groqModel } = getPrefs();
  if (!groqApiKey) {
    throw new Error("Groq API key not set. Add it in Settings.");
  }

  const body = {
    model: groqModel || "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant. Synthesize search results into a single concise paragraph with inline numeric citations. Stay strictly grounded in the provided sources.",
      },
      { role: "user", content: buildPrompt(query, topic, results) },
    ],
    temperature: 0.3,
    max_tokens: 400,
  };

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(`Groq ${res.status}: ${msg || res.statusText}`);
  }

  const data = (await res.json()) as GroqResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq returned no synthesis content.");
  return content;
}
