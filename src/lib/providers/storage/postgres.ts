import { StorageProvider, MemoryItem } from "./types";
import { database } from "../../db/server";

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

/** PostgreSQL persistence backed by the database attached to the Vercel project. */
export class PostgresStorageProvider implements StorageProvider {
  readonly kind = "postgres" as const;

  async getPreferences(userId: string) {
    const sql = await database();
    const rows = await sql`select prefs from user_preferences where user_id = ${userId} limit 1`;
    const row = rows[0] as { prefs?: Record<string, unknown> } | undefined;
    return row?.prefs ?? null;
  }

  async setPreferences(userId: string, prefs: Record<string, unknown>) {
    const sql = await database();
    await sql`
      insert into user_preferences (user_id, prefs, updated_at)
      values (${userId}, ${JSON.stringify(prefs)}::jsonb, now())
      on conflict (user_id) do update set prefs = excluded.prefs, updated_at = now()
    `;
  }

  async listMemories(userId: string): Promise<MemoryItem[]> {
    const sql = await database();
    const rows = await sql`
      select id, kind, key, value, created_at
      from memory_items
      where user_id = ${userId}
      order by created_at desc
    `;
    return rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        kind: r.kind as MemoryItem["kind"],
        key: r.key == null ? undefined : String(r.key),
        value: String(r.value),
        createdAt: toIso(r.created_at),
      };
    });
  }

  async addMemory(userId: string, item: Omit<MemoryItem, "id" | "createdAt">): Promise<MemoryItem> {
    const sql = await database();
    const rows = await sql`
      insert into memory_items (user_id, kind, key, value)
      values (${userId}, ${item.kind}, ${item.key ?? null}, ${item.value})
      returning id, kind, key, value, created_at
    `;
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) throw new Error("No se pudo guardar la memoria");
    return {
      id: String(r.id),
      kind: r.kind as MemoryItem["kind"],
      key: r.key == null ? undefined : String(r.key),
      value: String(r.value),
      createdAt: toIso(r.created_at),
    };
  }

  async removeMemory(userId: string, id: string) {
    const sql = await database();
    await sql`delete from memory_items where user_id = ${userId} and id = ${id}::uuid`;
  }
}
