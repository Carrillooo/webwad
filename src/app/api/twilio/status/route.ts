import { NextRequest, NextResponse } from "next/server";
import { validTwilioSignature } from "@/lib/twilio/signature";
import { getCall, updateCall, type CallStatus } from "@/lib/twilio/store";
import { requestOrigin } from "@/lib/http/origin";
import { isDatabaseConfigured } from "@/lib/db/server";
import { pushToUser } from "@/lib/push/send";

export const runtime = "nodejs";

const FINAL: Record<string, CallStatus> = {
  completed: "completada",
  busy: "ocupado",
  "no-answer": "sin_respuesta",
  failed: "fallida",
  canceled: "fallida",
};

const AVISO: Record<CallStatus, string> = {
  iniciando: "",
  sonando: "",
  en_curso: "",
  completada: "",
  sin_respuesta: "No han cogido el teléfono.",
  ocupado: "Comunicaba; prueba más tarde.",
  fallida: "La llamada falló.",
};

/**
 * POST /api/twilio/status?cid= — fin de llamada. Actualiza el estado y avisa
 * al dueño por push con el resultado, para que no tenga que preguntar.
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
  if (!call) return NextResponse.json({ ok: true });
  if (call.callSid && params.CallSid && params.CallSid !== call.callSid) {
    return new NextResponse("llamada desconocida", { status: 403 });
  }

  const mapped = FINAL[params.CallStatus ?? ""];
  if (!mapped) return NextResponse.json({ ok: true }); // estados intermedios: nada que hacer

  const durationS = params.CallDuration ? Number(params.CallDuration) : null;
  // Si el webhook de voz ya cerró con resultado, el estado final no lo pisa.
  const status = call.status === "completada" && mapped === "completada" ? "completada" : mapped;
  await updateCall(cid, { status, durationS });

  const quien = call.contactName ?? call.toNumber;
  const fresh = await getCall(cid);
  const body =
    status === "completada"
      ? fresh?.result ?? "Gestión terminada."
      : AVISO[status] || "La llamada terminó.";
  try {
    await pushToUser(call.userId, isDatabaseConfigured(), {
      title: `📞 Llamada a ${quien}`,
      body,
    });
  } catch (e) {
    console.error("aviso de fin de llamada falló", e);
  }
  return NextResponse.json({ ok: true });
}
