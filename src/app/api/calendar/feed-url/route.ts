import { NextRequest, NextResponse } from "next/server";
import { guardApi } from "@/lib/api-guard";
import { feedToken, isFeedConfigured } from "@/lib/calendar/ics";
import { requestOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";

/**
 * GET /api/calendar/feed-url — devuelve el enlace de suscripción para la UI.
 * Va autenticado (a diferencia del propio feed) para no repartir el token, y
 * el enlace lleva el id del usuario: cada cuenta publica SU agenda.
 */
export async function GET(req: NextRequest) {
  if (!isFeedConfigured()) {
    return NextResponse.json({ configured: false });
  }
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId } = g.ctx;
  const origin = requestOrigin(req);
  const url = `${origin}/api/calendar/feed.ics?u=${encodeURIComponent(userId)}&token=${feedToken(userId)}`;
  return NextResponse.json({
    configured: true,
    url,
    // webcal:// hace que iPhone/Mac abran directamente el diálogo de suscripción.
    webcal: url.replace(/^https?:/, "webcal:"),
  });
}
