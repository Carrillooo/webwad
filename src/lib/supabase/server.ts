import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { serverConfig } from "../config";

/**
 * Server-side Supabase access. The service-role client bypasses RLS and must
 * NEVER be exposed to the browser. When Supabase isn't configured, callers fall
 * back to local/in-memory storage so the demo keeps working.
 */
export function isSupabaseConfigured(): boolean {
  return (
    serverConfig.supabase.url.trim().length > 0 &&
    serverConfig.supabase.serviceRoleKey.trim().length > 0
  );
}

let _service: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado");
  }
  if (!_service) {
    _service = createClient(serverConfig.supabase.url, serverConfig.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _service;
}
