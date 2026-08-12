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

/** Browser SpeechSynthesis TTS. */
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
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang;
    u.rate = opts.rate;
    u.volume = opts.volume;
    const voices = window.speechSynthesis.getVoices();
    const chosen =
      (opts.voiceName && voices.find((v) => v.name === opts.voiceName)) ||
      voices.find((v) => v.lang?.startsWith("es")) ||
      null;
    if (chosen) u.voice = chosen;
    u.onstart = () => opts.onStart?.();
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
    window.speechSynthesis.speak(u);
  }
  cancel() {
    if (this.available) window.speechSynthesis.cancel();
  }
}
