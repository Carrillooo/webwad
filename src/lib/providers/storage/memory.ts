import { StorageProvider, MemoryItem } from "./types";

/** In-memory storage (demo / unauthenticated). Resets on server restart. */
const g = globalThis as unknown as {
  __novaStorage?: { prefs: Map<string, Record<string, unknown>>; mem: Map<string, MemoryItem[]> };
};
function state() {
  if (!g.__novaStorage) g.__novaStorage = { prefs: new Map(), mem: new Map() };
  return g.__novaStorage;
}

let seq = 0;

export class MemoryStorageProvider implements StorageProvider {
  readonly kind = "memory" as const;

  async getPreferences(userId: string) {
    return state().prefs.get(userId) ?? null;
  }
  async setPreferences(userId: string, prefs: Record<string, unknown>) {
    state().prefs.set(userId, prefs);
  }
  async listMemories(userId: string) {
    return state().mem.get(userId) ?? [];
  }
  async addMemory(userId: string, item: Omit<MemoryItem, "id" | "createdAt">) {
    seq += 1;
    const full: MemoryItem = { ...item, id: `mem-${seq}`, createdAt: new Date().toISOString() };
    const list = state().mem.get(userId) ?? [];
    list.unshift(full);
    state().mem.set(userId, list);
    return full;
  }
  async removeMemory(userId: string, id: string) {
    const list = state().mem.get(userId) ?? [];
    state().mem.set(userId, list.filter((m) => m.id !== id));
  }
}
