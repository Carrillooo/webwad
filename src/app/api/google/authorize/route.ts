import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google/oauth";
import { signState } from "@/lib/google/state";
import { resolveUser } from "@/lib/auth";
import { oauthRedirectUri } from "@/lib/http/origin";

/** GET /api/google/authorize — starts the OAuth flow (redirect to Google). */
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth no está configurado. Ver /setup." },
      { status: 400 },
    );
  }
  const { userId, authed } = await resolveUser(req);
  // Mismo origen que el callback: así no depende de GOOGLE_REDIRECT_URI.
  const url = buildAuthUrl(signState({ uid: userId, authed }), oauthRedirectUri(req, "google"));
  return NextResponse.redirect(url);
}
