"use client";
import { useEffect, useRef } from "react";
import { SPEECH_END_EVENT } from "./useAssistant";

/**
 * Continuous conversation: when ZERO finishes a reply that ended in a question,
 * re-open the microphone by itself so Daniel can answer straight away instead
 * of pressing the crystal again. A short pause lets the speakers settle first,
 * so the mic doesn't catch the tail of ZERO's own voice.
 */
export function useAutoListen(enabled: boolean, activate: () => void) {
  const cbRef = useRef(activate);
  useEffect(() => {
    cbRef.current = activate;
  }, [activate]);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const onEnd = (e: Event) => {
      const detail = (e as CustomEvent<{ awaitingAnswer?: boolean }>).detail;
      if (!detail?.awaitingAnswer) return;
      timer = window.setTimeout(() => cbRef.current(), 320);
    };
    window.addEventListener(SPEECH_END_EVENT, onEnd);
    return () => {
      window.removeEventListener(SPEECH_END_EVENT, onEnd);
      window.clearTimeout(timer);
    };
  }, [enabled]);
}
