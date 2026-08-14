import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchGoogleProfile, fetchUserEmail } from "@/lib/google/oauth";
import { verifyState } from "@/lib/google/state";
import { saveConnection } from "@/lib/google/connection";
import { findOrCreateOAuthUser, createSession, SESSION_COOKIE } from "@/lib/auth/users";
import { appHome, oauthRedirectUri, requestOrigin } from "@/lib/http/origin";
import { classifyOAuthError } from "@/lib/http/oauth-error";

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

  // «Continuar con Google»: entrar (o crear la cuenta) y dejar Google enlazado.
  if (parsed.login) {
    try {
      const tokens = await exchangeCode(code, oauthRedirectUri(req, "google"));
      const profile = await fetchGoogleProfile(tokens.accessToken);
      if (!profile.email) {
        home.searchParams.set("login", "sin_email");
        return NextResponse.redirect(home);
      }
      const out = await findOrCreateOAuthUser(profile.email, profile.name ?? "");
      if ("error" in out) {
        home.searchParams.set("login", out.error);
        return NextResponse.redirect(home);
      }
      try {
        await saveConnection(out.user.id, true, tokens, profile.email);
        home.searchParams.set("google", "connected");
      } catch (e) {
        // Entrar funciona igualmente; la conexión dirá su motivo (p. ej. sin_cifrado).
        console.error("google login: la conexión no se pudo guardar", e);
        home.searchParams.set("google", classifyOAuthError(e));
      }
      const { token, expiresAt } = await createSession(out.user.id);
      const res = NextResponse.redirect(home);
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: requestOrigin(req).startsWith("https"),
        path: "/",
        expires: expiresAt,
      });
      return res;
    } catch (e) {
      console.error("google login error", e);
      home.searchParams.set("login", classifyOAuthError(e));
      return NextResponse.redirect(home);
    }
  }

  try {
    const tokens = await exchangeCode(code, oauthRedirectUri(req, "google"));
    const email = await fetchUserEmail(tokens.accessToken);
    await saveConnection(parsed.uid, parsed.authed, tokens, email);
    home.searchParams.set("google", "connected");
  } catch (e) {
    console.error("google callback error", e);
    home.searchParams.set("google", classifyOAuthError(e));
  }
  return NextResponse.redirect(home);
}
