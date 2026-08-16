import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api-guard";
import { leerQuery } from "@/lib/security/input";
import { saveSubscription, removeSubscription } from "@/lib/push/store";
import { isPushConfigured, serverConfig } from "@/lib/config";

const Sub = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

/** POST /api/push/subscribe — store a Web Push subscription. */
export async function POST(req: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push no configurado (faltan claves VAPID)." }, { status: 400 });
  }
  const g = await guardApi(req);
  if (g.res) return g.res;
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "suscripción inválida" }, { status: 400 });
  const { userId, authed } = g.ctx;
  await saveSubscription(userId, authed, parsed.data);
  return NextResponse.json({ ok: true });
}

/** GET /api/push/subscribe — returns the VAPID public key for the client. */
export async function GET() {
  return NextResponse.json({ configured: isPushConfigured(), publicKey: serverConfig.vapid.publicKey });
}

/** DELETE /api/push/subscribe?endpoint=... — unsubscribe. */
export async function DELETE(req: NextRequest) {
  const q = leerQuery(req, z.object({ endpoint: z.string().url().max(600) }));
  if (!q.ok) return q.res;
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  await removeSubscription(userId, authed, q.data.endpoint);
  return NextResponse.json({ ok: true });
}
