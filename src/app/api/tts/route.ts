import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig, isElevenLabsConfigured } from "@/lib/config";

export const runtime = "nodejs";

/** GET → whether ElevenLabs is configured (the client decides to use it or
 *  fall back to the browser's SpeechSynthesis). Never exposes the key. */
export async function GET() {
  return NextResponse.json({ configured: isElevenLabsConfigured() });
}

const BodySchema = z.object({
  text: z.string().min(1).max(2500),
});

/** POST { text } → audio/mpeg. Proxies ElevenLabs so the API key stays on the
 *  server. Errors return JSON so the client can fall back to browser TTS. */
export async function POST(req: NextRequest) {
  if (!isElevenLabsConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { apiKey, voiceId } = serverConfig.elevenlabs;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.25 },
        }),
        // ElevenLabs can take a few seconds on long texts.
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
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
