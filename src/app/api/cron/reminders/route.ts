import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { ensureOwnerUser } from "@/lib/supabase/owner";
import { DEMO_USER_ID } from "@/lib/auth";
import { pushToUser } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/config";
import { humanTime } from "@/lib/datetime";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** GET /api/cron/reminders — push a heads-up ~30 min before each event.
 *  Designed for a 15-minute cron: it only looks at events starting in the
 *  [now+30, now+45) window, so each event is notified exactly once. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: false, reason: "push_not_configured" });

  const ownerId = await ensureOwnerUser();
  const userId = ownerId ?? DEMO_USER_ID;
  const authed = ownerId !== null;

  const now = Date.now();
  const winStart = new Date(now + 30 * 60_000);
  const winEnd = new Date(now + 45 * 60_000);
  const providers = await resolveProviders(userId, authed);
  const events = await providers.calendar.listEvents(winStart.toISOString(), winEnd.toISOString());
  const upcoming = events.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= winStart.getTime() && t < winEnd.getTime();
  });

  let sent = 0;
  for (const e of upcoming) {
    const where = e.location ? ` · ${e.location}` : "";
    const r = await pushToUser(userId, authed, {
      title: `⏰ ${e.title}`,
      body: `Empieza a las ${humanTime(new Date(e.start))}${where}`,
      url: "/",
    });
    sent += r.sent;
  }
  return NextResponse.json({ ok: true, events: upcoming.length, sent });
}
