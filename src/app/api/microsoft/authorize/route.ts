import { NextRequest, NextResponse } from "next/server";
import { buildMsAuthUrl, isMicrosoftConfigured } from "@/lib/microsoft/oauth";
import { signState } from "@/lib/google/state";
import { resolveUser } from "@/lib/auth";

/** GET /api/microsoft/authorize — starts the Outlook OAuth flow. */
export async function GET(req: NextRequest) {
  if (!isMicrosoftConfigured()) {
    return NextResponse.json(
      { error: "Microsoft OAuth no está configurado (MICROSOFT_CLIENT_ID/SECRET)." },
      { status: 400 },
    );
  }
  const { userId, authed } = await resolveUser(req);
  return NextResponse.redirect(buildMsAuthUrl(signState({ uid: userId, authed })));
}
