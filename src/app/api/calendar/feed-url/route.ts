import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { serverConfig } from "@/lib/config";
import { feedToken, isFeedConfigured } from "@/lib/calendar/ics";

export const runtime = "nodejs";

/**
 * GET /api/calendar/feed-url — devuelve el enlace de suscripción para la UI.
 * Va autenticado (a diferencia del propio feed) para no repartir el token.
 */
export async function GET(req: NextRequest) {
  if (!isFeedConfigured()) {
    return NextResponse.json({ configured: false });
  }
  const { userId } = await resolveUser(req);
  // El host real de la petición manda: así funciona igual en local y en Vercel.
  const origin = req.nextUrl.origin || serverConfig.appUrl;
  const url = `${origin}/api/calendar/feed.ics?token=${feedToken(userId)}`;
  return NextResponse.json({
    configured: true,
    url,
    // webcal:// hace que iPhone/Mac abran directamente el diálogo de suscripción.
    webcal: url.replace(/^https?:/, "webcal:"),
  });
}
