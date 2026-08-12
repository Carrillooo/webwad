"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Browser Supabase client (anon/publishable key). Null when not configured. */
let _client: SupabaseClient | null | undefined;

export function browserSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    _client = null;
    return null;
  }
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}

/** Bridge the client session to the server: resolveUser reads this cookie. */
export function setAuthCookie(accessToken: string | null) {
  if (typeof document === "undefined") return;
  if (accessToken) {
    document.cookie = `sb-access-token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
  } else {
    document.cookie = "sb-access-token=; path=/; max-age=0; SameSite=Lax";
  }
}
