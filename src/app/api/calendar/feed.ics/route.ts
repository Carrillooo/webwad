import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { ensureOwnerUser } from "@/lib/db/owner";
import { DEMO_USER_ID } from "@/lib/auth";
import { buildIcs, verifyFeedToken, isFeedConfigured } from "@/lib/calendar/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ventana publicada: 3 meses atrás y 1 año por delante. */
const DAYS_BACK = 90;
const DAYS_AHEAD = 365;
/** Cada cuánto pedimos a los clientes que refresquen. */
const REFRESH_MINUTES = 15;

/**
 * GET /api/calendar/feed.ics?token=... — agenda de ZERO en formato iCalendar.
 *
 * Pensado para suscribirse desde Apple Calendar / Google Calendar / Outlook:
 * esos clientes piden la URL sin cabeceras de autenticación, así que el
 * permiso viaja en un token firmado. Es SOLO LECTURA: quien tenga el enlace
 * ve la agenda, pero no puede modificar nada.
 */
export async function GET(req: NextRequest) {
  if (!isFeedConfigured()) {
    return NextResponse.json(
      { error: "Falta CALENDAR_FEED_SECRET (o TOKEN_ENCRYPTION_KEY) para firmar el enlace." },
      { status: 503 },
    );
  }

  const ownerId = await ensureOwnerUser();
  const userId = ownerId ?? DEMO_USER_ID;
  const authed = ownerId !== null;

  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!verifyFeedToken(userId, token)) {
    return NextResponse.json({ error: "Enlace no válido." }, { status: 403 });
  }

  const now = Date.now();
  const start = new Date(now - DAYS_BACK * 86_400_000).toISOString();
  const end = new Date(now + DAYS_AHEAD * 86_400_000).toISOString();

  const providers = await resolveProviders(userId, authed);
  const events = await providers.calendar.listEvents(start, end);
  const ics = buildIcs(events, { name: "ZERO · Daniel", refreshMinutes: REFRESH_MINUTES });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="zero.ics"',
      // Los clientes refrescan por su cuenta; nunca sirvas una copia rancia.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
