import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverConfig } from "./config";
import { isSupabaseConfigured } from "./supabase/server";
import { ensureOwnerUser } from "./supabase/owner";

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

  // 1) A real interactive session (once a login UI exists) always wins.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer ?? req.cookies.get("sb-access-token")?.value;
  if (token) {
    try {
      const anon = createClient(serverConfig.supabase.url, serverConfig.supabase.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.getUser(token);
      if (!error && data.user) return { userId: data.user.id, authed: true };
    } catch {
      /* fall through to owner mode */
    }
  }

  // 2) Single-owner mode: persist under a stable owner user (no login needed).
  const ownerId = await ensureOwnerUser();
  if (ownerId) return { userId: ownerId, authed: true };

  // 3) Supabase unreachable/misconfigured → in-memory demo.
  return { userId: DEMO_USER_ID, authed: false };
}
