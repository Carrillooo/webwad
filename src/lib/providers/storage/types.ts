/** Persistence abstraction for preferences + controlled memory. */

export interface MemoryItem {
  id: string;
  kind: "preference" | "fact" | "note";
  key?: string;
  value: string;
  createdAt: string;
}

export interface StorageProvider {
  readonly kind: "postgres" | "memory";
  getPreferences(userId: string): Promise<Record<string, unknown> | null>;
  setPreferences(userId: string, prefs: Record<string, unknown>): Promise<void>;
  listMemories(userId: string): Promise<MemoryItem[]>;
  addMemory(userId: string, item: Omit<MemoryItem, "id" | "createdAt">): Promise<MemoryItem>;
  removeMemory(userId: string, id: string): Promise<void>;
}
