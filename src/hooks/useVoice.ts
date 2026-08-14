"use client";
import { useCallback, useMemo, useRef } from "react";
import { useNova } from "@/lib/store";
import { useMicLevel } from "./useMicLevel";
import { WebSpeechSTT } from "@/lib/providers/speech/browser";

/**
 * Push-to-talk controller. Starts the mic visualizer + Web Speech STT,
 * streams the transcript, and hands the final text to `onFinal`.
 * Gracefully degrades: if STT is unavailable it signals so the UI can
 * offer the keyboard fallback.
 */
export function useVoice(onFinal: (text: string) => void) {
  const stt = useMemo(() => (typeof window !== "undefined" ? new WebSpeechSTT() : null), []);
  const { level, error: micError, start: startMic, stop: stopMic } = useMicLevel();
  const active = useRef(false);
  const finalRef = useRef("");

  const sttAvailable = stt?.available ?? false;

  const stop = useCallback(() => {
    active.current = false;
    stt?.stop();
    stopMic();
  }, [stt, stopMic]);

  const start = useCallback(async () => {
    if (active.current) return;
    const store = useNova.getState();
    finalRef.current = "";
    active.current = true;
    store.setNovaState("listening");
    store.setTranscript("");

    const gotMic = await startMic();
    if (gotMic !== true) {
      active.current = false;
      // El motivo exacto sube a la UI para explicar QUÉ tocar (candado,
      // ajustes del sistema…) — un parpadeo rojo mudo no ayuda a nadie.
      return { micDenied: true, reason: gotMic };
    }

    if (!stt || !stt.available) {
      // Mic works (for visualizer) but no STT: keep listening state and let
      // the UI prompt for keyboard input.
      return { noStt: true };
    }

    stt.start({
      lang: store.settings.language,
      onResult: (r) => {
        useNova.getState().setTranscript(r.transcript);
        if (r.isFinal) {
          finalRef.current = r.transcript;
          useNova.getState().setNovaState("transcribing");
        }
      },
      onError: () => {
        stop();
        useNova.getState().setNovaState("idle");
      },
      onEnd: () => {
        stopMic();
        active.current = false;
        const text = finalRef.current || useNova.getState().transcript;
        if (text.trim()) onFinal(text.trim());
        else useNova.getState().setNovaState("idle");
      },
    });
    return {};
  }, [stt, startMic, stopMic, stop, onFinal]);

  return { start, stop, level, micError, sttAvailable, isActive: () => active.current };
}
