import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchUserEmail } from "@/lib/google/oauth";
import { verifyState } from "@/lib/google/state";
import { saveConnection } from "@/lib/google/connection";
import { appHome, oauthRedirectUri } from "@/lib/http/origin";

/** GET /api/google/callback — OAuth redirect target. Exchanges the code and
 *  stores the encrypted refresh token, then returns to the app. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const err = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  // Vuelve SIEMPRE a la web desde la que se pulsó "Conectar", no a APP_URL:
  // si esa variable no está puesta en Vercel, acabarías en localhost.
  const home = appHome(req);

  if (err) {
    home.searchParams.set("google", "error");
    return NextResponse.redirect(home);
  }
  if (!code || !state) {
    home.searchParams.set("google", "invalid");
    return NextResponse.redirect(home);
  }
  const parsed = verifyState(state);
  if (!parsed) {
    home.searchParams.set("google", "badstate");
    return NextResponse.redirect(home);
  }

  try {
    const tokens = await exchangeCode(code, oauthRedirectUri(req, "google"));
    const email = await fetchUserEmail(tokens.accessToken);
    await saveConnection(parsed.uid, parsed.authed, tokens, email);
    home.searchParams.set("google", "connected");
  } catch (e) {
    console.error("google callback error", e);
    home.searchParams.set("google", "error");
  }
  return NextResponse.redirect(home);
}
