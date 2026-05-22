import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getStoreValue,
  setStoreValue,
  deleteStoreValue,
  getStorePath,
  getPrefs,
  setPrefs,
} from "./utils/store";
import {
  listBooks,
  updateBookFrontmatter,
  todayIso,
  type BookStatus,
  type UpdateBookFields,
} from "./utils/vault";
import {
  listSessions,
  createSession,
  renameSession,
  deleteSession,
  addCapture,
  removeCapture,
  setActiveSession,
  type Capture,
} from "./utils/sessions";
import { runWebSearch, type SearchResult } from "./utils/search";
import { runSynthesis } from "./utils/synthesis";
import { writeCapture, listTags, type CaptureInput } from "./utils/captures";
import {
  ping as zoteroPing,
  listCollections as zoteroListCollections,
  listItems as zoteroListItems,
  addNote as zoteroAddNote,
  type ListItemsOpts as ZoteroListItemsOpts,
} from "./utils/zotero";
import {
  listClippedNotes,
  startClipperWatcher,
  restartClipperWatcher,
  stopClipperWatcher,
} from "./utils/clipper";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST_ELECTRON = __dirname;
const DIST_RENDERER = path.join(DIST_ELECTRON, "../dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 600,
    title: "Research Hub",
    backgroundColor: "#1C1917",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(DIST_ELECTRON, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(DIST_RENDERER, "index.html"));
  }
}

ipcMain.on("store:get", (event, key: string) => {
  event.returnValue = getStoreValue(key);
});

ipcMain.on("store:set", (_event, key: string, value: unknown) => {
  setStoreValue(key, value);
});

ipcMain.on("store:delete", (_event, key: string) => {
  deleteStoreValue(key);
});

ipcMain.handle("prefs:get", () => getPrefs());

ipcMain.handle("prefs:storePath", () => getStorePath());

ipcMain.handle("prefs:revealStore", () => {
  shell.showItemInFolder(getStorePath());
  return { ok: true };
});

ipcMain.handle("prefs:set", async (_event, patch: Record<string, unknown>) => {
  const before = getPrefs();
  const next = setPrefs(patch);
  if (
    before.vaultPath !== next.vaultPath ||
    before.clipperFolder !== next.clipperFolder
  ) {
    await restartClipperWatcher();
  }
  return next;
});

ipcMain.handle("prefs:pickVault", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win!, {
    title: "Choose your Obsidian vault",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const chosen = result.filePaths[0];
  setPrefs({ vaultPath: chosen });
  await restartClipperWatcher();
  return getPrefs();
});

ipcMain.handle("books:list", async () => {
  try {
    const { vaultPath } = getPrefs();
    const books = await listBooks(vaultPath);
    return { ok: true as const, books };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
});

ipcMain.handle(
  "books:updateStatus",
  async (_event, filePath: string, status: BookStatus) => {
    try {
      const fields: UpdateBookFields = { Status: status };
      if (status === "inprogress") fields.Start_date = todayIso();
      if (status === "completed" || status === "dnf") fields.Finish_date = todayIso();
      const book = await updateBookFrontmatter(filePath, fields);
      return { ok: true as const, book };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  },
);

ipcMain.handle(
  "books:updateRating",
  async (_event, filePath: string, rating: number | null) => {
    try {
      const book = await updateBookFrontmatter(filePath, { My_rate: rating });
      return { ok: true as const, book };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  },
);

ipcMain.handle("books:revealInFinder", (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
  return { ok: true };
});

ipcMain.handle("sessions:list", () => listSessions());

ipcMain.handle("sessions:create", (_event, name: string, topic: string) =>
  createSession(name, topic),
);

ipcMain.handle("sessions:rename", (_event, id: string, name: string, topic: string) =>
  renameSession(id, name, topic),
);

ipcMain.handle("sessions:delete", (_event, id: string) => {
  deleteSession(id);
  return { ok: true };
});

ipcMain.handle("sessions:setActive", (_event, id: string) => {
  setActiveSession(id);
  return { ok: true };
});

ipcMain.handle(
  "sessions:addCapture",
  (_event, sessionId: string, capture: Omit<Capture, "id" | "addedAt">) =>
    addCapture(sessionId, capture),
);

ipcMain.handle(
  "sessions:removeCapture",
  (_event, sessionId: string, captureId: string) =>
    removeCapture(sessionId, captureId),
);

ipcMain.handle("search:run", async (_event, query: string) => {
  try {
    const results = await runWebSearch(query);
    return { ok: true as const, results };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
});

ipcMain.handle(
  "synthesis:run",
  async (
    _event,
    query: string,
    topic: string,
    results: SearchResult[],
  ) => {
    try {
      const text = await runSynthesis(query, topic, results);
      return { ok: true as const, text };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  },
);

ipcMain.handle("clipper:list", async () => {
  try {
    const notes = await listClippedNotes();
    return { ok: true as const, notes };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("captures:write", async (_event, payload: CaptureInput) => {
  try {
    const result = await writeCapture(payload);
    return { ok: true as const, ...result };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("tags:list", () => listTags());

ipcMain.handle("zotero:ping", () => zoteroPing());

ipcMain.handle("zotero:listCollections", async () => {
  try {
    const collections = await zoteroListCollections();
    return { ok: true as const, collections };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
});

ipcMain.handle(
  "zotero:listItems",
  async (_event, opts: ZoteroListItemsOpts = {}) => {
    try {
      const items = await zoteroListItems(opts);
      return { ok: true as const, items };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  },
);

ipcMain.handle(
  "zotero:addNote",
  async (_event, itemKey: string, text: string) => {
    return zoteroAddNote(itemKey, text);
  },
);

app.whenReady().then(async () => {
  createWindow();
  await startClipperWatcher();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  await stopClipperWatcher();
  if (process.platform !== "darwin") app.quit();
});
