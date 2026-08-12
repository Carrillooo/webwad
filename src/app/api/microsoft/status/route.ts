import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { getMsConnection } from "@/lib/microsoft/connection";
import { isMicrosoftConfigured } from "@/lib/microsoft/oauth";

/** GET /api/microsoft/status — Outlook connection state. */
export async function GET(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  const configured = isMicrosoftConfigured();
  const connection = configured ? await getMsConnection(userId, authed) : { connected: false };
  return NextResponse.json({ configured, connection });
}
