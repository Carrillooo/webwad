"use client";
import { useCallback, useMemo, useRef } from "react";
import { useNova } from "@/lib/store";
import { WebSpeechTTS } from "@/lib/providers/speech/browser";
import type { AssistantMessage } from "@/lib/providers/types";

/** Orchestrates a full assistant turn: states → API → apply → speak. */
export function useAssistant() {
  const tts = useMemo(() => (typeof window !== "undefined" ? new WebSpeechTTS() : null), []);
  const busy = useRef(false);

  const speak = useCallback(
    (text: string) => {
      const st = useNova.getState();
      if (!st.settings.voiceEnabled || !tts?.available) return;
      st.setNovaState("speaking");
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
        speak(turn.reply);
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
    tts?.cancel();
    if (useNova.getState().novaState === "speaking") useNova.getState().setNovaState("idle");
  }, [tts]);

  return { send, speak, stopSpeaking };
}
