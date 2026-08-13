"use client";
import { useCallback, useMemo, useRef } from "react";
import { useNova } from "@/lib/store";
import { WebSpeechTTS, cleanForSpeech } from "@/lib/providers/speech/browser";
import type { AssistantMessage } from "@/lib/providers/types";

/** Orchestrates a full assistant turn: states → API → apply → speak.
 *  Voice output tries ElevenLabs (ultra-realistic, via /api/tts) first and
 *  falls back to the browser's SpeechSynthesis when it isn't configured. */
export function useAssistant() {
  const tts = useMemo(() => (typeof window !== "undefined" ? new WebSpeechTTS() : null), []);
  const busy = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // null = unknown (probe on first use); then cached for the session.
  const elevenReady = useRef<boolean | null>(null);

  const speakWithBrowser = useCallback(
    (text: string) => {
      const st = useNova.getState();
      if (!tts?.available) {
        if (st.novaState === "speaking") st.setNovaState("idle");
        return;
      }
      tts.speak(text, {
        lang: st.settings.language,
        rate: st.settings.voiceRate,
        volume: st.settings.voiceVolume,
        voiceName: st.settings.voiceName,
        onEnd: () => {
          if (useNova.getState().novaState === "speaking") useNova.getState().setNovaState("idle");
        },
      });
    },
    [tts],
  );

  const speak = useCallback(
    async (text: string) => {
      const st = useNova.getState();
      if (!st.settings.voiceEnabled) return;
      const clean = cleanForSpeech(text);
      if (!clean) return;
      st.setNovaState("speaking");

      if (elevenReady.current === null) {
        try {
          const r = await fetch("/api/tts");
          elevenReady.current = r.ok && (await r.json()).configured === true;
        } catch {
          elevenReady.current = false;
        }
      }

      if (elevenReady.current) {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: clean.slice(0, 2500) }),
          });
          if (res.ok && res.headers.get("content-type")?.includes("audio")) {
            const url = URL.createObjectURL(await res.blob());
            const audio = new Audio(url);
            audio.volume = useNova.getState().settings.voiceVolume;
            audioRef.current = audio;
            const done = () => {
              URL.revokeObjectURL(url);
              if (audioRef.current === audio) audioRef.current = null;
              if (useNova.getState().novaState === "speaking")
                useNova.getState().setNovaState("idle");
            };
            audio.onended = done;
            audio.onerror = done;
            await audio.play();
            return;
          }
          // Upstream refused (bad key, quota, network): stop trying this
          // session so every later reply goes straight to the browser voice.
          elevenReady.current = false;
        } catch {
          elevenReady.current = false;
        }
      }
      speakWithBrowser(clean);
    },
    [speakWithBrowser],
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy.current) return;
      busy.current = true;
      const store = useNova.getState();
      store.setTranscript("");
      store.pushUser(clean);
      store.setNovaState("thinking");

      const messages: AssistantMessage[] = useNova.getState().messages;
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, state: store.conversation }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const turn = data.turn;

        // Reflect execution/planning visually before settling.
        if (turn.proposal) store.setNovaState("planning");
        else if (turn.receipts?.some((r: { kind: string }) => /create|update|delete|complete/.test(r.kind)))
          store.setNovaState("executing");

        useNova.getState().applyTurn(turn, data.demoMode);

        await new Promise((r) => setTimeout(r, 260));
        const anyFail = turn.receipts?.some((r: { ok: boolean }) => !r.ok);
        useNova.getState().setNovaState(anyFail ? "warning" : "success");
        void speak(turn.reply);
        setTimeout(() => {
          const cur = useNova.getState().novaState;
          if (cur === "success" || cur === "warning") useNova.getState().setNovaState("idle");
        }, 1400);
      } catch {
        useNova.getState().applyTurn(
          { reply: "Ha ocurrido un error de conexión. Inténtelo de nuevo.", view: "home" },
          useNova.getState().demoMode,
        );
        useNova.getState().setNovaState("error");
        setTimeout(() => useNova.getState().setNovaState("idle"), 1600);
      } finally {
        busy.current = false;
      }
    },
    [speak],
  );

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    tts?.cancel();
    if (useNova.getState().novaState === "speaking") useNova.getState().setNovaState("idle");
  }, [tts]);

  return { send, speak, stopSpeaking };
}
