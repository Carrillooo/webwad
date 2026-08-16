import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api-guard";
import { leerQuery } from "@/lib/security/input";
import {
  listExternalCalendars,
  addExternalCalendar,
  removeExternalCalendar,
  normalizeIcsUrl,
  fetchIcs,
} from "@/lib/calendar/external";

export const runtime = "nodejs";

/** GET /api/external-calendars — los calendarios enlazados del usuario. */
export async function GET(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const calendars = await listExternalCalendars(g.ctx.userId);
  return NextResponse.json({
    calendars: calendars.map((c) => ({ id: c.id, name: c.name, url: c.url })),
  });
}

const Body = z.object({ name: z.string().max(60), url: z.string().min(8).max(500) });

/** POST /api/external-calendars — enlaza un calendario por URL iCal.
 *  Se comprueba EN EL MOMENTO que el enlace responde y es un .ics de verdad:
 *  nada de guardar enlaces muertos. */
export async function POST(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  const norm = normalizeIcsUrl(parsed.data.url);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });

  const probe = await fetchIcs(norm.url);
  if (!probe.ok) return NextResponse.json({ error: probe.error }, { status: 400 });

  const added = await addExternalCalendar(g.ctx.userId, parsed.data.name, norm.url);
  if (!added.ok) return NextResponse.json({ error: added.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    calendar: { id: added.calendar.id, name: added.calendar.name, url: added.calendar.url },
  });
}

/** DELETE /api/external-calendars?id= — desenlaza un calendario. */
export async function DELETE(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const q = leerQuery(req, z.object({ id: z.string().min(1).max(120) }));
  if (!q.ok) return q.res;
  const ok = await removeExternalCalendar(g.ctx.userId, q.data.id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "No existe ese calendario." }, { status: 404 });
}
