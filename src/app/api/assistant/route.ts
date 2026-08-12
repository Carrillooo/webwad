import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAssistant } from "@/lib/providers/assistant";
import { serverConfig } from "@/lib/config";
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

  const assistant = getAssistant();
  try {
    const turn = await assistant.respond(parsed.data.messages, {
      ownerName: OWNER_NAME,
      nowIso: new Date().toISOString(),
      timezone: DEFAULT_TIMEZONE,
      demoMode: serverConfig.demoMode,
    }, parsed.data.state ?? {});
    return NextResponse.json({ turn, demoMode: serverConfig.demoMode });
  } catch (err) {
    console.error("assistant error", err);
    return NextResponse.json({ error: "El asistente falló al procesar la petición." }, { status: 500 });
  }
}
