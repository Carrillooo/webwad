import { NextRequest, NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";
import { dayBounds, weekBounds } from "@/lib/datetime";

/** GET /api/calendar?date=ISO&range=day|week|month */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const range = searchParams.get("range") ?? "day";
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

  const providers = getProviders();
  const [events, calendars] = await Promise.all([
    providers.calendar.listEvents(start.toISOString(), end.toISOString()),
    providers.calendar.listCalendars(),
  ]);
  return NextResponse.json({ events, calendars, demoMode: providers.demoMode });
}
