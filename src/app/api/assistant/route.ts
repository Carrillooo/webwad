import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAssistant } from "@/lib/providers/assistant";
import { MockAssistantProvider } from "@/lib/providers/assistant/mock";
import { resolveProviders } from "@/lib/providers";
import { resolveUser } from "@/lib/auth";
import { getStorage } from "@/lib/providers/storage";
import type { MemoryItem } from "@/lib/providers/storage/types";
import { OWNER_NAME, DEFAULT_TIMEZONE } from "@/lib/constants";

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

  const { userId, authed } = await resolveUser(req);
  const providers = await resolveProviders(userId, authed);
  const storage = getStorage(authed);
  const asKind = (k?: string): MemoryItem["kind"] =>
    k === "preference" || k === "note" ? k : "fact";
  const assistant = getAssistant(providers, {
    memory: {
      list: () => storage.listMemories(userId),
      remember: (value, kind) => storage.addMemory(userId, { kind: asKind(kind), value }),
      forget: async (id) => {
        await storage.removeMemory(userId, id);
        return true;
      },
    },
  });
  const ctx = {
    ownerName: OWNER_NAME,
    nowIso: new Date().toISOString(),
    timezone: DEFAULT_TIMEZONE,
    demoMode: providers.demoMode,
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
