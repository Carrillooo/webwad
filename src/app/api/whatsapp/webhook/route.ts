import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, verifySignature, parseIncoming } from "@/lib/providers/messaging/whatsapp";
import { isWhatsappConfigured } from "@/lib/config";
import { resolveProviders } from "@/lib/providers";
import { listBillableUsers } from "@/lib/auth/users";
import { DEMO_USER_ID } from "@/lib/auth";
import { parseDay } from "@/lib/nlu/spanish-datetime";
import { toZonedIso } from "@/lib/datetime";

/** GET — Meta webhook verification handshake. */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const challenge = verifyWebhook(sp.get("hub.mode"), sp.get("hub.verify_token"), sp.get("hub.challenge"));
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * POST — inbound messages. Content is UNTRUSTED. We DO NOT auto-reply or send
 * anything (spec: never send without explicit confirmation). We ingest the
 * message as a task/proposal for the owner to review in the app.
 */
export async function POST(req: NextRequest) {
  if (!isWhatsappConfigured()) return NextResponse.json({ ok: true, skipped: "not configured" });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = parseIncoming(payload);
  if (messages.length) {
    // El número de WhatsApp es único para toda la instalación, así que los
    // mensajes entran a la cuenta fundadora (multiusuario real de WhatsApp
    // exigiría mapear número→cuenta; queda para cuando haya pasarela).
    const owner = (await listBillableUsers()).find((u) => u.isOwner) ?? null;
    const providers = await resolveProviders(owner?.id ?? DEMO_USER_ID, Boolean(owner));
    for (const m of messages) {
      // Detect a date mention; store as a task the owner can turn into an event.
      const day = parseDay(m.text, new Date());
      const hasDay = /\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i.test(m.text);
      try {
        await providers.tasks.createTask({
          title: `WhatsApp: ${m.text.slice(0, 120)}`,
          notes: `De ${m.from}. Contenido no confiable.`,
          due: hasDay ? toZonedIso(day.date).slice(0, 10) : undefined,
        });
      } catch {
        /* ignore individual failures */
      }
    }
  }

  // Always 200 quickly so Meta doesn't retry.
  return NextResponse.json({ ok: true, ingested: messages.length });
}
