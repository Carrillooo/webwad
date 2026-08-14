import { isTwilioConfigured, serverConfig } from "../config";
import { isValidPhone, startTwilioCall } from "./api";
import { createCall, updateCall } from "./store";

export interface PlaceCallInput {
  to: string;
  contactName?: string;
  goal: string;
}

export interface PlaceCallResult {
  ok: boolean;
  detail: string;
  callId?: string;
}

/**
 * Arranca una llamada de ZERO. Nunca finge: si Twilio no acepta, el recibo es
 * negativo con el motivo. El resultado de la gestión llega después (webhooks).
 */
export async function placeCall(
  userId: string,
  origin: string,
  input: PlaceCallInput,
): Promise<PlaceCallResult> {
  if (!isTwilioConfigured()) {
    return {
      ok: false,
      detail:
        "Las llamadas no están configuradas todavía (faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER en Vercel).",
    };
  }
  if (!serverConfig.anthropic.apiKey) {
    return { ok: false, detail: "Sin ANTHROPIC_API_KEY no puedo mantener la conversación telefónica." };
  }
  const to = input.to.replace(/[\s().-]/g, "");
  if (!isValidPhone(to)) {
    return {
      ok: false,
      detail: `"${input.to}" no es un número válido. Necesito el formato internacional, p. ej. +34600112233.`,
    };
  }
  if (!input.goal.trim()) {
    return { ok: false, detail: "Dime qué hay que conseguir en la llamada (el objetivo)." };
  }

  const call = await createCall(userId, {
    toNumber: to,
    contactName: input.contactName?.trim() || undefined,
    goal: input.goal.trim().slice(0, 500),
  });
  const voiceUrl = `${origin}/api/twilio/voice?cid=${call.id}`;
  const statusUrl = `${origin}/api/twilio/status?cid=${call.id}`;
  const started = await startTwilioCall(to, voiceUrl, statusUrl);
  if (!started.ok) {
    await updateCall(call.id, { status: "fallida", result: started.detail });
    return { ok: false, detail: started.detail };
  }
  await updateCall(call.id, { callSid: started.callSid ?? null, status: "sonando" });
  return {
    ok: true,
    callId: call.id,
    detail: `Llamando a ${input.contactName ?? to}. Te aviso cuando termine; también puedes preguntarme "¿qué tal la llamada?".`,
  };
}
