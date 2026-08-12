import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import webpush from "web-push";
import { resolveUser } from "@/lib/auth";
import { listSubscriptions, removeSubscription } from "@/lib/push/store";
import { isPushConfigured, serverConfig } from "@/lib/config";

const Body = z.object({
  title: z.string().max(120).default("ZERO"),
  body: z.string().max(300).default(""),
  url: z.string().optional(),
});

/** POST /api/push/send — send a notification to the user's devices.
 *  Used for reminders ("Entrenamiento en 30 minutos") and testing. */
export async function POST(req: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push no configurado." }, { status: 400 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "inválido" }, { status: 400 });

  webpush.setVapidDetails(serverConfig.vapid.subject, serverConfig.vapid.publicKey, serverConfig.vapid.privateKey);

  const { userId, authed } = await resolveUser(req);
  const subs = await listSubscriptions(userId, authed);
  const payload = JSON.stringify(parsed.data);

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        sent += 1;
      } catch (e) {
        // Drop expired/invalid subscriptions (410 Gone / 404).
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) await removeSubscription(userId, authed, s.endpoint);
      }
    }),
  );
  return NextResponse.json({ ok: true, sent, total: subs.length });
}
