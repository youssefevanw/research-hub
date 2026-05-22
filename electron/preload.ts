import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("researchHubStore", {
  get: (key: string) => ipcRenderer.sendSync("store:get", key),
  set: (key: string, value: unknown) => ipcRenderer.send("store:set", key, value),
  delete: (key: string) => ipcRenderer.send("store:delete", key),
});

contextBridge.exposeInMainWorld("researchHub", {
  platform: process.platform,
  prefs: {
    get: () => ipcRenderer.invoke("prefs:get"),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke("prefs:set", patch),
    pickVault: () => ipcRenderer.invoke("prefs:pickVault"),
    storePath: () => ipcRenderer.invoke("prefs:storePath"),
    revealStore: () => ipcRenderer.invoke("prefs:revealStore"),
  },
  books: {
    list: () => ipcRenderer.invoke("books:list"),
    updateStatus: (filePath: string, status: string) =>
      ipcRenderer.invoke("books:updateStatus", filePath, status),
    updateRating: (filePath: string, rating: number | null) =>
      ipcRenderer.invoke("books:updateRating", filePath, rating),
    revealInFinder: (filePath: string) =>
      ipcRenderer.invoke("books:revealInFinder", filePath),
  },
  sessions: {
    list: () => ipcRenderer.invoke("sessions:list"),
    create: (name: string, topic: string) =>
      ipcRenderer.invoke("sessions:create", name, topic),
    rename: (id: string, name: string, topic: string) =>
      ipcRenderer.invoke("sessions:rename", id, name, topic),
    delete: (id: string) => ipcRenderer.invoke("sessions:delete", id),
    setActive: (id: string) => ipcRenderer.invoke("sessions:setActive", id),
    addCapture: (sessionId: string, capture: unknown) =>
      ipcRenderer.invoke("sessions:addCapture", sessionId, capture),
    removeCapture: (sessionId: string, captureId: string) =>
      ipcRenderer.invoke("sessions:removeCapture", sessionId, captureId),
  },
  search: {
    run: (query: string) => ipcRenderer.invoke("search:run", query),
  },
  synthesis: {
    run: (query: string, topic: string, results: unknown) =>
      ipcRenderer.invoke("synthesis:run", query, topic, results),
  },
  captures: {
    write: (payload: unknown) => ipcRenderer.invoke("captures:write", payload),
  },
  tags: {
    list: () => ipcRenderer.invoke("tags:list"),
  },
  clipper: {
    list: () => ipcRenderer.invoke("clipper:list"),
    onNew: (cb: (note: unknown) => void) => {
      const listener = (_event: unknown, note: unknown) => cb(note);
      ipcRenderer.on("clipper:new", listener);
      return () => ipcRenderer.removeListener("clipper:new", listener);
    },
    onRemoved: (cb: (payload: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload);
      ipcRenderer.on("clipper:removed", listener);
      return () => ipcRenderer.removeListener("clipper:removed", listener);
    },
  },
  zotero: {
    ping: () => ipcRenderer.invoke("zotero:ping"),
    listCollections: () => ipcRenderer.invoke("zotero:listCollections"),
    listItems: (opts: unknown) => ipcRenderer.invoke("zotero:listItems", opts),
    addNote: (itemKey: string, text: string) =>
      ipcRenderer.invoke("zotero:addNote", itemKey, text),
  },
});
