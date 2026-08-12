import { serviceClient, isSupabaseConfigured } from "../supabase/server";

/** Web Push subscription persistence. Supabase for authed users; memory else. */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const g = globalThis as unknown as { __novaPush?: Map<string, PushSub[]> };
function mem() {
  if (!g.__novaPush) g.__novaPush = new Map();
  return g.__novaPush;
}
function shouldUseDb(authed: boolean) {
  return authed && isSupabaseConfigured();
}

export async function saveSubscription(userId: string, authed: boolean, sub: PushSub): Promise<void> {
  if (shouldUseDb(authed)) {
    await serviceClient()
      .from("push_subscriptions")
      .upsert({ user_id: userId, endpoint: sub.endpoint, keys: sub.keys }, { onConflict: "user_id,endpoint" });
    return;
  }
  const list = mem().get(userId) ?? [];
  if (!list.some((s) => s.endpoint === sub.endpoint)) list.push(sub);
  mem().set(userId, list);
}

export async function listSubscriptions(userId: string, authed: boolean): Promise<PushSub[]> {
  if (shouldUseDb(authed)) {
    const { data } = await serviceClient().from("push_subscriptions").select("endpoint, keys").eq("user_id", userId);
    return (data ?? []).map((r) => ({ endpoint: r.endpoint as string, keys: r.keys as PushSub["keys"] }));
  }
  return mem().get(userId) ?? [];
}

export async function removeSubscription(userId: string, authed: boolean, endpoint: string): Promise<void> {
  if (shouldUseDb(authed)) {
    await serviceClient().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    return;
  }
  mem().set(userId, (mem().get(userId) ?? []).filter((s) => s.endpoint !== endpoint));
}
