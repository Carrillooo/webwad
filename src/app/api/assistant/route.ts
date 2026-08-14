import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAssistant } from "@/lib/providers/assistant";
import { MockAssistantProvider } from "@/lib/providers/assistant/mock";
import { resolveProviders } from "@/lib/providers";
import { guardApi } from "@/lib/api-guard";
import { getStorage } from "@/lib/providers/storage";
import type { MemoryItem } from "@/lib/providers/storage/types";
import { OWNER_NAME, DEFAULT_TIMEZONE } from "@/lib/constants";
import { mailSenderFor, sendMailForUser } from "@/lib/mail/user-mail";
import { requestOrigin } from "@/lib/http/origin";
import { isTwilioConfigured, serverConfig } from "@/lib/config";
import { placeCall } from "@/lib/twilio/place";
import { listCalls } from "@/lib/twilio/store";

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(50),
  state: z
    .object({
      pendingProposal: z.any().optional().nullable(),
      recentEventIds: z.array(z.string()).optional(),
      lastCreatedEventId: z.string().optional(),
      pendingBulk: z
        .object({
          type: z.enum(["tasks", "events"]),
          startIso: z.string().optional(),
          endIso: z.string().optional(),
        })
        .optional()
        .nullable(),
      pendingEventDraft: z
        .object({ startIso: z.string(), endIso: z.string(), dayLabel: z.string() })
        .optional()
        .nullable(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  // Autenticación ANTES de leer el body: sin sesión no se revela ni el schema.
  const g = await guardApi(req);
  if (g.res) return g.res;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Petición inválida", issues: parsed.error.issues }, { status: 400 });
  }

  const { userId, authed } = g.ctx;
  const providers = await resolveProviders(userId, authed);
  const storage = getStorage(authed);
  const asKind = (k?: string): MemoryItem["kind"] =>
    k === "preference" || k === "note" ? k : "fact";
  const assistant = getAssistant(providers, {
    userKey: userId,
    memory: {
      list: () => storage.listMemories(userId),
      remember: (value, kind) => storage.addMemory(userId, { kind: asKind(kind), value }),
      forget: async (id) => {
        await storage.removeMemory(userId, id);
        return true;
      },
    },
    // El correo sale del buzón del propio usuario (Gmail/Outlook conectado).
    mail: { send: (input) => sendMailForUser(userId, authed, input) },
    // Llamadas telefónicas (Twilio): solo si está configurado de verdad.
    ...(isTwilioConfigured() && serverConfig.anthropic.apiKey
      ? {
          calls: {
            place: (input: { to: string; contactName?: string; goal: string }) =>
              placeCall(userId, requestOrigin(req), input),
            list: async () =>
              (await listCalls(userId, 5)).map((c) => ({
                to: c.toNumber,
                contactName: c.contactName,
                goal: c.goal,
                status: c.status,
                result: c.result,
                createdAt: c.createdAt,
              })),
          },
        }
      : {}),
  });
  const sender = await mailSenderFor(userId, authed);
  const ctx = {
    // Cada cuenta tiene su nombre: ZERO habla con quien ha iniciado sesión.
    ownerName: g.ctx.user?.displayName ?? OWNER_NAME,
    nowIso: new Date().toISOString(),
    timezone: DEFAULT_TIMEZONE,
    demoMode: providers.demoMode,
    mailFrom: sender
      ? `${sender.address}${sender.via === "gmail" ? " (su Gmail)" : sender.via === "outlook" ? " (su Outlook)" : ""}`
      : null,
    canCall: isTwilioConfigured() && serverConfig.anthropic.apiKey.length > 0,
  };
  const startedAt = Date.now();
  try {
    const turn = await assistant.respond(parsed.data.messages, ctx, parsed.data.state ?? {});
    const ms = Date.now() - startedAt;
    // Visible en la terminal: si ZERO va lento, aquí se ve exactamente cuánto
    // tarda el modelo (el resto de la app son milisegundos).
    console.log(`[zero] respuesta en ${ms} ms (${assistant.kind})`);
    return NextResponse.json({ turn, demoMode: providers.demoMode, ms });
  } catch (err) {
    // If Anthropic fails (billing, rate limit, outage), degrade to the local
    // NLU engine so ZERO keeps working instead of erroring out.
    console.error("assistant error", err);
    if (assistant.kind === "anthropic") {
      try {
        const turn = await new MockAssistantProvider(providers).respond(
          parsed.data.messages,
          ctx,
          parsed.data.state ?? {},
        );
        return NextResponse.json({ turn, demoMode: providers.demoMode, fallback: "mock" });
      } catch (err2) {
        console.error("mock fallback error", err2);
      }
    }
    return NextResponse.json({ error: "El asistente falló al procesar la petición." }, { status: 500 });
  }
}
