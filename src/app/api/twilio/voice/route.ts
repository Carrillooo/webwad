import { NextRequest, NextResponse } from "next/server";
import { validTwilioSignature } from "@/lib/twilio/signature";
import { getCall, updateCall, type CallTurn } from "@/lib/twilio/store";
import { nextCallUtterance } from "@/lib/twilio/call-brain";
import { speakAndListen, speakAndHangup } from "@/lib/twilio/twiml";
import { requestOrigin } from "@/lib/http/origin";
import { OWNER_NAME } from "@/lib/constants";
import { listAllUsers } from "@/lib/auth/users";

export const runtime = "nodejs";

/** Tope duro de turnos: si la conversación se enreda, ZERO se despide. */
const MAX_TURNS = 30;

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

/** Nombre a usar al presentarse: el de la cuenta dueña de la llamada. */
async function ownerNameFor(userId: string): Promise<string> {
  try {
    const users = await listAllUsers();
    return users.find((u) => u.id === userId)?.displayName ?? OWNER_NAME;
  } catch {
    return OWNER_NAME;
  }
}

/**
 * POST /api/twilio/voice?cid=<llamada> — webhook de conversación de Twilio.
 * Público por necesidad, pero SOLO acepta peticiones firmadas con nuestro
 * auth token (X-Twilio-Signature). Cada turno: oye → piensa → responde.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  form?.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });

  const url = `${requestOrigin(req)}${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (!validTwilioSignature(req.headers.get("x-twilio-signature"), url, params)) {
    return new NextResponse("firma inválida", { status: 403 });
  }

  const cid = req.nextUrl.searchParams.get("cid") ?? "";
  const call = await getCall(cid);
  if (!call) return xml(speakAndHangup("Lo siento, esta llamada ya no está activa. Adiós."));
  // La llamada tiene que ser LA nuestra: mismo CallSid que creamos en Twilio.
  if (call.callSid && params.CallSid && params.CallSid !== call.callSid) {
    return new NextResponse("llamada desconocida", { status: 403 });
  }

  const turns: CallTurn[] = [...call.turns];
  const heard = (params.SpeechResult ?? "").trim();
  if (heard) turns.push({ who: "persona", text: heard.slice(0, 600) });

  if (turns.length >= MAX_TURNS) {
    await updateCall(cid, { turns, status: "completada", result: "La conversación se alargó demasiado y ZERO se despidió." });
    return xml(speakAndHangup("Disculpe, lo dejamos aquí. Gracias por su tiempo. Adiós."));
  }

  try {
    const ownerName = await ownerNameFor(call.userId);
    const reply = await nextCallUtterance(ownerName, call.contactName, call.goal, turns);
    turns.push({ who: "zero", text: reply.say });

    if (reply.done) {
      await updateCall(cid, {
        turns,
        status: "completada",
        result: reply.result ?? "Gestión terminada (sin resumen).",
      });
      return xml(speakAndHangup(reply.say));
    }
    await updateCall(cid, { turns, status: "en_curso" });
    return xml(speakAndListen(reply.say, url));
  } catch (e) {
    console.error("cerebro de llamada falló", e);
    await updateCall(cid, { turns, status: "fallida", result: "Fallo técnico durante la llamada." });
    return xml(speakAndHangup("Disculpe, tengo un problema técnico. Le llamaremos en otro momento. Adiós."));
  }
}
