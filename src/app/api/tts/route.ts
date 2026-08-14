import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig, isElevenLabsConfigured } from "@/lib/config";
import { guardApi } from "@/lib/api-guard";

export const runtime = "nodejs";

const MAX_TEXT = 2500;

/**
 * Proxies ElevenLabs so the API key never leaves the server.
 *
 * Latency matters more than anything here: ZERO is a voice assistant. We use
 * the streaming endpoint with the flash model, and the client points an
 * <audio> element straight at the GET route so the browser plays the first
 * chunk while the rest is still being synthesised.
 */
/** Los ids de ElevenLabs son alfanuméricos; así no se cuela nada en la URL. */
function safeVoiceId(requested: string | null | undefined): string {
  const fallback = serverConfig.elevenlabs.voiceId;
  if (!requested) return fallback;
  return /^[A-Za-z0-9]{16,40}$/.test(requested) ? requested : fallback;
}

async function synthesize(text: string, voice?: string | null): Promise<Response> {
  const { apiKey, model } = serverConfig.elevenlabs;
  const voiceId = safeVoiceId(voice);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream` +
      `?output_format=mp3_22050_32&optimize_streaming_latency=3`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.45, similarity_boost: 0.75, speed: 1.05 },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "upstream", status: res.status }, { status: 502 });
  }
  return new NextResponse(res.body, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

/** GET ?text=... → streamed audio (playable as an <audio> src, lowest latency).
 *  GET without `text` → {configured} so the client knows whether to use it. */
export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text");
  if (!text) return NextResponse.json({ configured: isElevenLabsConfigured() });
  if (!isElevenLabsConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  // La síntesis gasta cuota de ElevenLabs: solo cuentas con sesión y plan vivo.
  const g = await guardApi(req);
  if (g.res) return g.res;
  try {
    return await synthesize(text.slice(0, MAX_TEXT), req.nextUrl.searchParams.get("voice"));
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_TEXT),
  voice: z.string().max(40).optional(),
});

/** POST { text } → same audio stream. Used for texts too long for a URL. */
export async function POST(req: NextRequest) {
  if (!isElevenLabsConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const g = await guardApi(req);
  if (g.res) return g.res;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    return await synthesize(parsed.data.text, parsed.data.voice);
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
