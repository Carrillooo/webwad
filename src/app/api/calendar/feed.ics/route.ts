import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { buildIcs, verifyFeedToken, isFeedConfigured } from "@/lib/calendar/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ventana publicada: 3 meses atrás y 1 año por delante. */
const DAYS_BACK = 90;
const DAYS_AHEAD = 365;
/** Cada cuánto pedimos a los clientes que refresquen. */
const REFRESH_MINUTES = 15;

/**
 * GET /api/calendar/feed.ics?u=<usuario>&token=... — agenda en iCalendar.
 *
 * Multiusuario: el enlace lleva el id de la cuenta y un token HMAC derivado de
 * ese id, así cada persona publica SU agenda y nadie puede pedir la de otro
 * sin su token. Los clientes de calendario no mandan cabeceras de sesión, por
 * eso el permiso viaja en la URL. Solo lectura.
 */
export async function GET(req: NextRequest) {
  if (!isFeedConfigured()) {
    return NextResponse.json(
      { error: "Falta CALENDAR_FEED_SECRET (o TOKEN_ENCRYPTION_KEY) para firmar el enlace." },
      { status: 503 },
    );
  }

  const userId = req.nextUrl.searchParams.get("u") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!userId || !verifyFeedToken(userId, token)) {
    return NextResponse.json({ error: "Enlace no válido." }, { status: 403 });
  }

  const now = Date.now();
  const start = new Date(now - DAYS_BACK * 86_400_000).toISOString();
  const end = new Date(now + DAYS_AHEAD * 86_400_000).toISOString();

  const providers = await resolveProviders(userId, true);
  const events = await providers.calendar.listEvents(start, end);
  const ics = buildIcs(events, { name: "ZERO", refreshMinutes: REFRESH_MINUTES });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="zero.ics"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
