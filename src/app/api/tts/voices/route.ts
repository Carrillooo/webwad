import { NextResponse } from "next/server";
import { serverConfig, isElevenLabsConfigured } from "@/lib/config";

export const runtime = "nodejs";

export interface VoiceOption {
  id: string;
  name: string;
  /** "masculina · español" cuando ElevenLabs lo etiqueta. */
  detail: string;
}

const cache = globalThis as unknown as { __zeroVoices?: { at: number; list: VoiceOption[] } };
const TTL_MS = 10 * 60_000;

/** GET /api/tts/voices — voces disponibles en la cuenta de ElevenLabs, para
 *  poder fijar una desde Ajustes. Nunca expone la API key. */
export async function GET() {
  if (!isElevenLabsConfigured()) return NextResponse.json({ configured: false, voices: [] });

  const hit = cache.__zeroVoices;
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ configured: true, voices: hit.list });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": serverConfig.elevenlabs.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ configured: true, voices: [], error: res.status });
    const data = (await res.json()) as {
      voices?: { voice_id: string; name: string; labels?: Record<string, string> }[];
    };
    const list: VoiceOption[] = (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      detail: [v.labels?.gender, v.labels?.language ?? v.labels?.accent, v.labels?.description]
        .filter(Boolean)
        .join(" · "),
    }));
    cache.__zeroVoices = { at: Date.now(), list };
    return NextResponse.json({ configured: true, voices: list });
  } catch {
    return NextResponse.json({ configured: true, voices: [], error: "network" });
  }
}
