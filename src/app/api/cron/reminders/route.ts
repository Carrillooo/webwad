import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { listBillableUsers } from "@/lib/auth/users";
import { listSubscriptions } from "@/lib/push/store";
import { pushToUser } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/config";
import { humanTime } from "@/lib/datetime";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** GET /api/cron/reminders — aviso ~30 min antes de cada evento, por usuario.
 *  Pensado para un cron de 15 min: mira solo los eventos que empiezan en la
 *  ventana [ahora+30, ahora+45), así cada evento se avisa exactamente una vez. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: false, reason: "push_not_configured" });

  const users = await listBillableUsers();
  const now = Date.now();
  const winStart = new Date(now + 30 * 60_000);
  const winEnd = new Date(now + 45 * 60_000);

  let sent = 0;
  let eventsFound = 0;
  for (const u of users) {
    try {
      const subs = await listSubscriptions(u.id, true);
      if (subs.length === 0) continue;

      const providers = await resolveProviders(u.id, true);
      const events = await providers.calendar.listEvents(winStart.toISOString(), winEnd.toISOString());
      const upcoming = events.filter((e) => {
        const t = new Date(e.start).getTime();
        return t >= winStart.getTime() && t < winEnd.getTime();
      });
      eventsFound += upcoming.length;

      for (const e of upcoming) {
        const where = e.location ? ` · ${e.location}` : "";
        const r = await pushToUser(u.id, true, {
          title: `⏰ ${e.title}`,
          body: `Empieza a las ${humanTime(new Date(e.start))}${where}`,
          url: "/",
        });
        sent += r.sent;
      }
    } catch (e) {
      console.error(`reminders: fallo con ${u.id}`, e);
    }
  }
  return NextResponse.json({ ok: true, users: users.length, events: eventsFound, sent });
}
