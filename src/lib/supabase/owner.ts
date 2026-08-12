import { serviceClient, isSupabaseConfigured } from "./server";

/**
 * Single-owner mode: ZERO is a personal assistant, so when Supabase is
 * configured but there is no interactive login yet, we persist everything under
 * one stable "owner" auth user (get-or-create via the Admin API). This makes
 * preferences, memory and the Google connection survive restarts without a
 * login UI. Best-effort: any failure returns null and callers fall back to
 * in-memory storage, so the app never breaks.
 */
const OWNER_EMAIL = "danielrolmovil@gmail.com";

const g = globalThis as unknown as { __novaOwnerId?: string | null };

export async function ensureOwnerUser(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  if (g.__novaOwnerId !== undefined) return g.__novaOwnerId;

  try {
    const admin = serviceClient().auth.admin;
    // Look for an existing owner (first page is enough for a single-user app).
    const { data: list } = await admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email === OWNER_EMAIL);
    if (existing) {
      g.__novaOwnerId = existing.id;
      return existing.id;
    }
    const { data: created, error } = await admin.createUser({
      email: OWNER_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: "Daniel" },
    });
    if (error || !created.user) {
      g.__novaOwnerId = null;
      return null;
    }
    // Best-effort profile row (ignored if the table isn't migrated yet).
    await serviceClient()
      .from("profiles")
      .upsert({ id: created.user.id, display_name: "Daniel" }, { onConflict: "id" });
    g.__novaOwnerId = created.user.id;
    return created.user.id;
  } catch {
    g.__novaOwnerId = null;
    return null;
  }
}
