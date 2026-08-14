import { serverConfig } from "../config";

/** Cliente REST mínimo de Twilio (sin SDK: una llamada, un fetch). */

/** E.164: +34600000000 — lo único que aceptamos marcar. */
export function isValidPhone(n: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(n.trim());
}

export interface StartCallResult {
  ok: boolean;
  callSid?: string;
  detail: string;
}

/**
 * Crea la llamada saliente. Twilio irá pidiendo el TwiML a voiceUrl turno a
 * turno y avisará del final en statusUrl. TimeLimit corta a los 5 minutos:
 * una gestión telefónica no debería durar más (y limita el coste).
 */
export async function startTwilioCall(
  to: string,
  voiceUrl: string,
  statusUrl: string,
): Promise<StartCallResult> {
  const { accountSid, authToken, fromNumber } = serverConfig.twilio;
  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Url: voiceUrl,
    Method: "POST",
    StatusCallback: statusUrl,
    StatusCallbackMethod: "POST",
    Timeout: "25",
    TimeLimit: "300",
  });
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const j = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok || !j.sid) {
      return {
        ok: false,
        detail: `Twilio no aceptó la llamada (${res.status}): ${j.message ?? "error desconocido"}`,
      };
    }
    return { ok: true, callSid: j.sid, detail: "Llamada iniciada." };
  } catch (e) {
    return { ok: false, detail: `No se pudo contactar con Twilio: ${(e as Error).message}` };
  }
}
