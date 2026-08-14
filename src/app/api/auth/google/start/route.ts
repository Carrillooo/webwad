import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google/oauth";
import { signState } from "@/lib/google/state";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { appHome, oauthRedirectUri } from "@/lib/http/origin";

/**
 * GET /api/auth/google/start — «Continuar con Google».
 *
 * Un solo viaje: entra (o crea la cuenta) Y deja Google enlazado, porque el
 * consentimiento que concede ya incluye Calendar/Tasks/Drive/Docs/Gmail.
 * El callback es el mismo de siempre (/api/google/callback) con login=true
 * en el state firmado, así no hay que registrar más URIs en Google Cloud.
 */
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    const home = appHome(req);
    home.searchParams.set("login", "google_no_configurado");
    return NextResponse.redirect(home);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAttempt(`oauthlogin:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }
  const url = buildAuthUrl(
    signState({ uid: "", authed: false, login: true }),
    oauthRedirectUri(req, "google"),
  );
  return NextResponse.redirect(url);
}
