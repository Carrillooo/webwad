import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { disconnect } from "@/lib/google/connection";

/** POST /api/google/disconnect — removes the stored connection + tokens. */
export async function POST(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  await disconnect(userId, authed);
  return NextResponse.json({ ok: true });
}
