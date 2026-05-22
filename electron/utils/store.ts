import Store from "electron-store";

const store = new Store({
  name: "store",
  clearInvalidConfig: false,
});

let lastInternalWriteTs = 0;

function markInternalWrite(): void {
  lastInternalWriteTs = Date.now();
}

export function getStoreValue(key: string): unknown {
  return store.has(key) ? store.get(key) : null;
}

export function setStoreValue(key: string, value: unknown): void {
  store.set(key, value);
  markInternalWrite();
}

export function deleteStoreValue(key: string): void {
  store.delete(key);
  markInternalWrite();
}

export function getStorePath(): string {
  return store.path;
}

export function wasInternalWriteRecent(maxAgeMs = 800): boolean {
  return Date.now() - lastInternalWriteTs < maxAgeMs;
}

export const DEFAULT_PREFS = {
  vaultPath: "",
  clipperFolder: "Clippings",
  dailyNoteFolder: "Daily",
  dailyNoteIntegration: false,
  zoteroPort: 23119,
  aiSynthesis: false,
  theme: "minimal-dark",
  tavilyApiKey: "",
  groqApiKey: "",
  groqModel: "llama-3.3-70b-versatile",
  activeSessionId: "",
  lastTag: "",
};

export type Prefs = typeof DEFAULT_PREFS;

export function getPrefs(): Prefs {
  const stored = (getStoreValue("rh_prefs") as Partial<Prefs> | null) ?? {};
  return { ...DEFAULT_PREFS, ...stored };
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  setStoreValue("rh_prefs", next);
  return next;
}
