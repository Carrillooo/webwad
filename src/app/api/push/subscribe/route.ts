import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveUser } from "@/lib/auth";
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
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "suscripción inválida" }, { status: 400 });
  const { userId, authed } = await resolveUser(req);
  await saveSubscription(userId, authed, parsed.data);
  return NextResponse.json({ ok: true });
}

/** GET /api/push/subscribe — returns the VAPID public key for the client. */
export async function GET() {
  return NextResponse.json({ configured: isPushConfigured(), publicKey: serverConfig.vapid.publicKey });
}

/** DELETE /api/push/subscribe?endpoint=... — unsubscribe. */
export async function DELETE(req: NextRequest) {
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint requerido" }, { status: 400 });
  const { userId, authed } = await resolveUser(req);
  await removeSubscription(userId, authed, endpoint);
  return NextResponse.json({ ok: true });
}
