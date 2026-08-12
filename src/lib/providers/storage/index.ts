import { StorageProvider } from "./types";
import { MemoryStorageProvider } from "./memory";
import { SupabaseStorageProvider } from "./supabase";
import { isSupabaseConfigured } from "../../supabase/server";

/** Supabase storage only for authenticated users; else in-memory (demo). */
export function getStorage(authed: boolean): StorageProvider {
  if (authed && isSupabaseConfigured()) return new SupabaseStorageProvider();
  return new MemoryStorageProvider();
}
