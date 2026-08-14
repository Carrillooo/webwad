import { NextRequest, NextResponse } from "next/server";
import { buildMsAuthUrl, isMicrosoftConfigured } from "@/lib/microsoft/oauth";
import { signState } from "@/lib/google/state";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { appHome, oauthRedirectUri } from "@/lib/http/origin";

/**
 * GET /api/auth/microsoft/start — «Continuar con Microsoft».
 * Igual que el de Google: inicia sesión Y deja Outlook enlazado en un viaje,
 * reutilizando /api/microsoft/callback con login=true en el state firmado.
 */
export async function GET(req: NextRequest) {
  if (!isMicrosoftConfigured()) {
    const home = appHome(req);
    home.searchParams.set("login", "microsoft_no_configurado");
    return NextResponse.redirect(home);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAttempt(`oauthlogin:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }
  const url = buildMsAuthUrl(
    signState({ uid: "", authed: false, login: true }),
    oauthRedirectUri(req, "microsoft"),
  );
  return NextResponse.redirect(url);
}
