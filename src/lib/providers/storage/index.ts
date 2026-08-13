import { StorageProvider } from "./types";
import { MemoryStorageProvider } from "./memory";
import { PostgresStorageProvider } from "./postgres";
import { isDatabaseConfigured } from "../../db/server";

/** Vercel Postgres for persistent owner data; memory only as a safe fallback. */
export function getStorage(authed: boolean): StorageProvider {
  if (authed && isDatabaseConfigured()) return new PostgresStorageProvider();
  return new MemoryStorageProvider();
}
