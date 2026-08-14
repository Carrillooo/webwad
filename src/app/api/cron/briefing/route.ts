import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { listBillableUsers } from "@/lib/auth/users";
import { listSubscriptions } from "@/lib/push/store";
import { pushToUser } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/config";
import { dayBounds, humanTime } from "@/lib/datetime";
import { getForecast } from "@/lib/weather";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return true; // sin secreto configurado → llamadas internas de Vercel
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** GET /api/cron/briefing — push matinal con la agenda de CADA usuario.
 *  Multiusuario: recorre todas las cuentas vivas (activas o en prueba) y solo
 *  molesta a quienes tienen notificaciones activadas en algún dispositivo. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: false, reason: "push_not_configured" });

  const users = await listBillableUsers();
  const now = new Date();
  const { start, end } = dayBounds(now);
  // El tiempo es común (Madrid): una sola consulta para todos.
  const forecast = await getForecast();

  let notified = 0;
  for (const u of users) {
    try {
      const subs = await listSubscriptions(u.id, true);
      if (subs.length === 0) continue;

      const providers = await resolveProviders(u.id, true);
      const [events, allTasks] = await Promise.all([
        providers.calendar.listEvents(start.toISOString(), end.toISOString()),
        providers.tasks.listTasks(),
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
      if (tasks.length > 0)
        parts.push(`${tasks.length} tarea${tasks.length > 1 ? "s" : ""} pendiente${tasks.length > 1 ? "s" : ""}`);
      if (forecast.ok && forecast.days[0]) {
        const d = forecast.days[0];
        parts.push(`${d.summary}, ${d.min}–${d.max}°C${d.rainChance >= 40 ? ` (lluvia ${d.rainChance}%)` : ""}`);
      }

      const r = await pushToUser(u.id, true, {
        title: `☀️ Buenos días, ${u.displayName}`,
        body: parts.join(" — "),
        url: "/",
      });
      if (r.sent > 0) notified += 1;
    } catch (e) {
      // Un usuario con la conexión rota no debe tumbar el briefing del resto.
      console.error(`briefing: fallo con ${u.id}`, e);
    }
  }
  return NextResponse.json({ ok: true, users: users.length, notified });
}
