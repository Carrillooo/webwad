import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverConfig } from "./config";
import { isSupabaseConfigured } from "./supabase/server";

/** Stable id for the unauthenticated demo user (local/in-memory storage only). */
export const DEMO_USER_ID = "demo-user";

export interface UserContext {
  userId: string;
  /** true only when a valid Supabase session was resolved (safe to hit Postgres). */
  authed: boolean;
}

/**
 * Resolve the current user from a Supabase access token (Authorization: Bearer
 * or the `sb-access-token` cookie). Falls back to the demo user so the app
 * works without login. When Supabase auth is wired in the UI, authed=true and
 * per-user persistence kicks in automatically.
 */
export async function resolveUser(req: NextRequest): Promise<UserContext> {
  if (!isSupabaseConfigured()) return { userId: DEMO_USER_ID, authed: false };

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer ?? req.cookies.get("sb-access-token")?.value;
  if (!token) return { userId: DEMO_USER_ID, authed: false };

  try {
    const anon = createClient(serverConfig.supabase.url, serverConfig.supabase.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) return { userId: DEMO_USER_ID, authed: false };
    return { userId: data.user.id, authed: true };
  } catch {
    return { userId: DEMO_USER_ID, authed: false };
  }
}
