import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { ensureOwnerUser } from "@/lib/db/owner";
import { DEMO_USER_ID } from "@/lib/auth";
import { pushToUser } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/config";
import { dayBounds, humanTime } from "@/lib/datetime";
import { getForecast } from "@/lib/weather";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return true; // no secret configured → open (Vercel-internal calls)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** GET /api/cron/briefing — morning push with today's agenda + weather.
 *  Wired to a Vercel cron (~08:00 Madrid). Safe to call manually. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: false, reason: "push_not_configured" });

  const ownerId = await ensureOwnerUser();
  const userId = ownerId ?? DEMO_USER_ID;
  const authed = ownerId !== null;

  const now = new Date();
  const { start, end } = dayBounds(now);
  const providers = await resolveProviders(userId, authed);
  const [events, allTasks, forecast] = await Promise.all([
    providers.calendar.listEvents(start.toISOString(), end.toISOString()),
    providers.tasks.listTasks(),
    getForecast(),
  ]);
  const tasks = allTasks.filter((t) => t.status === "needsAction");

  const parts: string[] = [];
  parts.push(
    events.length === 0
      ? "Sin eventos hoy."
      : `${events.length} evento${events.length > 1 ? "s" : ""}: ` +
          events
            .slice(0, 3)
            .map((e) => `${humanTime(new Date(e.start))} ${e.title}`)
            .join(" · ") +
          (events.length > 3 ? "…" : ""),
  );
  if (tasks.length > 0) parts.push(`${tasks.length} tarea${tasks.length > 1 ? "s" : ""} pendiente${tasks.length > 1 ? "s" : ""}`);
  if (forecast.ok && forecast.days[0]) {
    const d = forecast.days[0];
    parts.push(`${d.summary}, ${d.min}–${d.max}°C${d.rainChance >= 40 ? ` (lluvia ${d.rainChance}%)` : ""}`);
  }

  const { sent, total } = await pushToUser(userId, authed, {
    title: "☀️ Buenos días, Daniel",
    body: parts.join(" — "),
    url: "/",
  });
  return NextResponse.json({ ok: true, sent, total, events: events.length, tasks: tasks.length });
}
