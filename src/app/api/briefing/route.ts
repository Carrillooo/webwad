import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";
import { dayBounds, nowZoned, makeZonedInstant } from "@/lib/datetime";

/** GET /api/briefing — structured summary of today for Home + Briefing views. */
export async function GET() {
  const now = new Date();
  const { start, end } = dayBounds(now);
  const providers = getProviders();
  const [events, allTasks, busy] = await Promise.all([
    providers.calendar.listEvents(start.toISOString(), end.toISOString()),
    providers.tasks.listTasks(),
    providers.calendar.freeBusy(start.toISOString(), end.toISOString()),
  ]);
  const tasks = allTasks.filter((t) => t.status === "needsAction");
  const nextEvent = events.find((e) => new Date(e.start).getTime() > now.getTime()) ?? null;

  // Largest free gap within [08:00, 22:00] Europe/Madrid wall-clock.
  const z = nowZoned(now);
  const y = z.getFullYear();
  const m = z.getMonth() + 1;
  const d = z.getDate();
  const dayS = makeZonedInstant(y, m, d, 8, 0);
  const dayE = makeZonedInstant(y, m, d, 22, 0);
  const sorted = busy.slice().sort((a, b) => a.start.localeCompare(b.start));
  let cursor = Math.max(dayS.getTime(), now.getTime());
  let best: { start: string; end: string; minutes: number } | null = null;
  const consider = (s: number, e: number) => {
    const m = Math.round((e - s) / 60000);
    if (m >= 30 && (!best || m > best.minutes))
      best = { start: new Date(s).toISOString(), end: new Date(e).toISOString(), minutes: m };
  };
  for (const b of sorted) {
    const bs = new Date(b.start).getTime();
    if (bs > cursor) consider(cursor, bs);
    cursor = Math.max(cursor, new Date(b.end).getTime());
  }
  if (dayE.getTime() > cursor) consider(cursor, dayE.getTime());

  return NextResponse.json({
    events,
    tasks,
    nextEvent,
    mainFreeSlot: best,
    demoMode: providers.demoMode,
  });
}
