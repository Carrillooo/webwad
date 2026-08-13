import { database, isDatabaseConfigured } from "../db/server";

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
  return authed && isDatabaseConfigured();
}

export async function saveSubscription(userId: string, authed: boolean, sub: PushSub): Promise<void> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`
      insert into push_subscriptions (user_id, endpoint, keys)
      values (${userId}, ${sub.endpoint}, ${JSON.stringify(sub.keys)}::jsonb)
      on conflict (user_id, endpoint) do update set keys = excluded.keys
    `;
    return;
  }
  const list = mem().get(userId) ?? [];
  if (!list.some((s) => s.endpoint === sub.endpoint)) list.push(sub);
  mem().set(userId, list);
}

export async function listSubscriptions(userId: string, authed: boolean): Promise<PushSub[]> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    const rows = await sql`select endpoint, keys from push_subscriptions where user_id = ${userId}`;
    return rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      return { endpoint: String(r.endpoint), keys: r.keys as PushSub["keys"] };
    });
  }
  return mem().get(userId) ?? [];
}

export async function removeSubscription(userId: string, authed: boolean, endpoint: string): Promise<void> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`delete from push_subscriptions where user_id = ${userId} and endpoint = ${endpoint}`;
    return;
  }
  mem().set(userId, (mem().get(userId) ?? []).filter((s) => s.endpoint !== endpoint));
}
