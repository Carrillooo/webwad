import { NextRequest } from "next/server";
import { ensureOwnerUser } from "./db/owner";
import { isDatabaseConfigured } from "./db/server";

/** Stable id for the non-persistent demo fallback. */
export const DEMO_USER_ID = "demo-user";

export interface UserContext {
  userId: string;
  /** true when requests are backed by the persistent Vercel Postgres owner. */
  authed: boolean;
}

/**
 * ZERO is a single-owner assistant. Supabase Auth is no longer required: when
 * the Vercel database is available every request resolves to one stable owner
 * row. If the database is unavailable the app degrades to the in-memory demo.
 */
export async function resolveUser(_req: NextRequest): Promise<UserContext> {
  if (!isDatabaseConfigured()) return { userId: DEMO_USER_ID, authed: false };
  const ownerId = await ensureOwnerUser();
  if (ownerId) return { userId: ownerId, authed: true };
  return { userId: DEMO_USER_ID, authed: false };
}
