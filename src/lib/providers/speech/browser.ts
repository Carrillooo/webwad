"use client";
import { SpeechToTextProvider, TextToSpeechProvider, TtsOptions, SttResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

function getSpeechRecognition(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Web Speech API STT. Falls back to `available=false` when unsupported. */
export class WebSpeechSTT implements SpeechToTextProvider {
  readonly kind = "web-speech";
  private rec: SR | null = null;
  get available() {
    return getSpeechRecognition() !== null;
  }
  start(opts: { lang: string; onResult: (r: SttResult) => void; onError: (e: string) => void; onEnd: () => void }) {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      opts.onError("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.lang = opts.lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) opts.onResult({ transcript: final, isFinal: true });
      else if (interim) opts.onResult({ transcript: interim, isFinal: false });
    };
    rec.onerror = (e: any) => opts.onError(e?.error ?? "error");
    rec.onend = () => opts.onEnd();
    this.rec = rec;
    rec.start();
  }
  stop() {
    try {
      this.rec?.stop();
    } catch {
      /* ignore */
    }
  }
}

/** Strip things that make TTS sound robotic (emojis, markdown, list bullets). */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[*_`#>~[\]]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  const name = v.name.toLowerCase();
  const lang = (v.lang || "").toLowerCase();
  if (lang === "es-es") s += 6;
  else if (lang.startsWith("es")) s += 3;
  else return -1;
  if (name.includes("natural") || name.includes("neural")) s += 6;
  if (name.includes("online")) s += 3;
  if (name.includes("google")) s += 3;
  if (/elvira|alvaro|álvaro|abril|dario|darío|mónica|monica|helena|laura|pablo|triana|vera/.test(name)) s += 2;
  if (name.includes("espeak")) s -= 3;
  return s;
}

/** Browser SpeechSynthesis TTS with human-leaning voice selection. */
export class WebSpeechTTS implements TextToSpeechProvider {
  readonly kind = "web-speech";
  get available() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }
  listVoices() {
    if (!this.available) return [];
    return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
  }
  speak(text: string, opts: TtsOptions) {
    if (!this.available) {
      opts.onStart?.();
      opts.onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = opts.lang;
    u.rate = Math.min(2, opts.rate * 1.04);
    u.pitch = 1.02;
    u.volume = opts.volume;
    const voices = window.speechSynthesis.getVoices();
    const manual = opts.voiceName ? voices.find((v) => v.name === opts.voiceName) : undefined;
    const best = manual ?? [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
    if (best && scoreVoice(best) >= 0) u.voice = best;
    u.onstart = () => opts.onStart?.();
    u.onboundary = () => opts.onBoundary?.();
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
    window.speechSynthesis.speak(u);
  }
  cancel() {
    if (this.available) window.speechSynthesis.cancel();
  }
}
