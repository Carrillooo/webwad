import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { getConnection } from "@/lib/google/connection";
import { isGoogleConfigured } from "@/lib/google/oauth";

/** GET /api/google/status — connection state for the current user. */
export async function GET(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  const configured = isGoogleConfigured();
  const connection = configured ? await getConnection(userId, authed) : { connected: false };
  return NextResponse.json({ configured, connection });
}
