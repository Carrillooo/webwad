import { StorageProvider, MemoryItem } from "./types";
import { serviceClient } from "../../supabase/server";

/** Supabase-backed storage. Uses the service-role client with an explicit
 *  user_id (RLS is enforced conceptually by always scoping every query). */
export class SupabaseStorageProvider implements StorageProvider {
  readonly kind = "supabase" as const;

  async getPreferences(userId: string) {
    const { data } = await serviceClient()
      .from("user_preferences")
      .select("prefs")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.prefs as Record<string, unknown> | undefined) ?? null;
  }

  async setPreferences(userId: string, prefs: Record<string, unknown>) {
    await serviceClient()
      .from("user_preferences")
      .upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  async listMemories(userId: string): Promise<MemoryItem[]> {
    const { data } = await serviceClient()
      .from("memory_items")
      .select("id, kind, key, value, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id as string,
      kind: r.kind as MemoryItem["kind"],
      key: (r.key as string | null) ?? undefined,
      value: r.value as string,
      createdAt: r.created_at as string,
    }));
  }

  async addMemory(userId: string, item: Omit<MemoryItem, "id" | "createdAt">): Promise<MemoryItem> {
    const { data, error } = await serviceClient()
      .from("memory_items")
      .insert({ user_id: userId, kind: item.kind, key: item.key, value: item.value })
      .select("id, kind, key, value, created_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la memoria");
    return {
      id: data.id as string,
      kind: data.kind as MemoryItem["kind"],
      key: (data.key as string | null) ?? undefined,
      value: data.value as string,
      createdAt: data.created_at as string,
    };
  }

  async removeMemory(userId: string, id: string) {
    await serviceClient().from("memory_items").delete().eq("user_id", userId).eq("id", id);
  }
}
