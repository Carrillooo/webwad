import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveProviders } from "@/lib/providers";
import { guardApi } from "@/lib/api-guard";
import { leerQuery } from "@/lib/security/input";
import { dayBounds, weekBounds } from "@/lib/datetime";

const Query = z.object({
  // Una fecha que el navegador no sepa leer daba NaN y rompía los rangos.
  date: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  range: z.enum(["day", "week", "month"]).default("day"),
});

/** GET /api/calendar?date=ISO&range=day|week|month */
export async function GET(req: NextRequest) {
  const q = leerQuery(req, Query);
  if (!q.ok) return q.res;
  const { date: dateParam, range } = q.data;
  const base = dateParam ? new Date(dateParam) : new Date();

  let start: Date, end: Date;
  if (range === "week") {
    ({ start, end } = weekBounds(base));
  } else if (range === "month") {
    const b = dayBounds(base);
    start = new Date(b.start.getTime() - 31 * 86400000);
    end = new Date(b.end.getTime() + 31 * 86400000);
  } else {
    ({ start, end } = dayBounds(base));
  }

  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  const providers = await resolveProviders(userId, authed);
  const [events, calendars] = await Promise.all([
    providers.calendar.listEvents(start.toISOString(), end.toISOString()),
    providers.calendar.listCalendars(),
  ]);
  return NextResponse.json({ events, calendars, demoMode: providers.demoMode });
}
