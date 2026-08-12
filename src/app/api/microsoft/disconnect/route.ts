import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { disconnectMs } from "@/lib/microsoft/connection";

/** POST /api/microsoft/disconnect — removes the stored Outlook connection. */
export async function POST(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  await disconnectMs(userId, authed);
  return NextResponse.json({ ok: true });
}
