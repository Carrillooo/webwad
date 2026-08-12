import { createHmac, timingSafeEqual } from "node:crypto";
import { serverConfig } from "../../config";

/**
 * WhatsApp via the OFFICIAL Meta Cloud API. No scraping, no WhatsApp Web
 * automation. Outbound messages are only sent after explicit confirmation
 * (see docs/WHATSAPP_OPTIONAL.md). Inbound content is UNTRUSTED.
 */

/** Verify the webhook subscription (GET handshake). */
export function verifyWebhook(mode: string | null, token: string | null, challenge: string | null): string | null {
  if (mode === "subscribe" && token && token === serverConfig.whatsapp.verifyToken) return challenge;
  return null;
}

/** Validate X-Hub-Signature-256 against the raw body using the app secret. */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = serverConfig.whatsapp.appSecret;
  if (!secret) return true; // if no app secret configured, skip (dev)
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface IncomingMessage {
  from: string; // phone number
  text: string; // UNTRUSTED
  id: string;
}

/** Parse inbound text messages from a webhook payload. */
export function parseIncoming(payload: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const e of entries) {
    const changes = (e as { changes?: unknown[] }).changes ?? [];
    for (const c of changes) {
      const value = (c as { value?: { messages?: unknown[] } }).value;
      for (const m of value?.messages ?? []) {
        const msg = m as { from?: string; id?: string; type?: string; text?: { body?: string } };
        if (msg.type === "text" && msg.text?.body) {
          out.push({ from: msg.from ?? "", text: msg.text.body, id: msg.id ?? "" });
        }
      }
    }
  }
  return out;
}

/** Send a WhatsApp text message. Call ONLY after explicit user confirmation. */
export async function sendMessage(to: string, text: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${serverConfig.whatsapp.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverConfig.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    },
  );
  if (!res.ok) throw new Error(`WhatsApp send ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
