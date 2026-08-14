import { NextRequest, NextResponse } from "next/server";
import { buildMsAuthUrl, isMicrosoftConfigured } from "@/lib/microsoft/oauth";
import { signState } from "@/lib/google/state";
import { guardApi } from "@/lib/api-guard";
import { oauthRedirectUri } from "@/lib/http/origin";

/** GET /api/microsoft/authorize — starts the Outlook OAuth flow. */
export async function GET(req: NextRequest) {
  if (!isMicrosoftConfigured()) {
    return NextResponse.json(
      { error: "Microsoft OAuth no está configurado (MICROSOFT_CLIENT_ID/SECRET)." },
      { status: 400 },
    );
  }
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  // El redirect se calcula desde la petición para que coincida con el del
  // callback pase lo que pase con las variables de entorno.
  const redirectUri = oauthRedirectUri(req, "microsoft");
  return NextResponse.redirect(buildMsAuthUrl(signState({ uid: userId, authed }), redirectUri));
}
