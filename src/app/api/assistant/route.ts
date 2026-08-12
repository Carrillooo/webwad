import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAssistant } from "@/lib/providers/assistant";
import { MockAssistantProvider } from "@/lib/providers/assistant/mock";
import { resolveProviders } from "@/lib/providers";
import { resolveUser } from "@/lib/auth";
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
  const assistant = getAssistant(providers);
  const ctx = {
    ownerName: OWNER_NAME,
    nowIso: new Date().toISOString(),
    timezone: DEFAULT_TIMEZONE,
    demoMode: providers.demoMode,
  };
  try {
    const turn = await assistant.respond(parsed.data.messages, ctx, parsed.data.state ?? {});
    return NextResponse.json({ turn, demoMode: providers.demoMode });
  } catch (err) {
    // If Anthropic fails (billing, rate limit, outage), degrade to the local
    // NLU engine so NOVA keeps working instead of erroring out.
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
