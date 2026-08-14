import { NextRequest, NextResponse } from "next/server";
import { exchangeMsCode, fetchMsEmail, fetchMsProfile } from "@/lib/microsoft/oauth";
import { verifyState } from "@/lib/google/state";
import { saveMsConnection } from "@/lib/microsoft/connection";
import { findOrCreateOAuthUser, createSession, SESSION_COOKIE } from "@/lib/auth/users";
import { appHome, oauthRedirectUri, requestOrigin } from "@/lib/http/origin";
import { classifyOAuthError } from "@/lib/http/oauth-error";

/** GET /api/microsoft/callback — OAuth redirect target. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const err = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  // Igual que en Google: volver al origen real de la petición, no a APP_URL.
  const home = appHome(req);

  if (err || !code || !state) {
    home.searchParams.set("microsoft", err ? "error" : "invalid");
    return NextResponse.redirect(home);
  }
  const parsed = verifyState(state);
  if (!parsed) {
    home.searchParams.set("microsoft", "badstate");
    return NextResponse.redirect(home);
  }
  // «Continuar con Microsoft»: entrar (o crear la cuenta) y dejar Outlook enlazado.
  if (parsed.login) {
    try {
      const tokens = await exchangeMsCode(code, oauthRedirectUri(req, "microsoft"));
      const profile = await fetchMsProfile(tokens.accessToken);
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
        await saveMsConnection(out.user.id, true, tokens, profile.email);
        home.searchParams.set("microsoft", "connected");
      } catch (e) {
        console.error("microsoft login: la conexión no se pudo guardar", e);
        home.searchParams.set("microsoft", classifyOAuthError(e));
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
      console.error("microsoft login error", e);
      home.searchParams.set("login", classifyOAuthError(e));
      return NextResponse.redirect(home);
    }
  }

  try {
    const tokens = await exchangeMsCode(code, oauthRedirectUri(req, "microsoft"));
    const email = await fetchMsEmail(tokens.accessToken);
    await saveMsConnection(parsed.uid, parsed.authed, tokens, email);
    home.searchParams.set("microsoft", "connected");
  } catch (e) {
    console.error("microsoft callback error", e);
    home.searchParams.set("microsoft", classifyOAuthError(e));
  }
  return NextResponse.redirect(home);
}
