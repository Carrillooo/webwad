"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNova } from "@/lib/store";
import { WebSpeechTTS, cleanForSpeech } from "@/lib/providers/speech/browser";
import type { AssistantMessage } from "@/lib/providers/types";

/** Fired when ZERO finishes talking. `detail.awaitingAnswer` is true when the
 *  reply ended in a question, so the shell can re-open the mic by itself. */
export const SPEECH_END_EVENT = "nova:speech-end";

/** Does this reply expect Daniel to answer? (Ends in a question, or ZERO is
 *  waiting for a confirmation.) Accent-safe: `?` and `¿` are unambiguous. */
export function wantsAnswer(reply: string, hasProposal: boolean): boolean {
  if (hasProposal) return true;
  const t = reply.trim();
  return t.endsWith("?") || t.endsWith("?»") || t.endsWith('?"');
}

/**
 * Makes the crystal react to ElevenLabs audio the same way it reacts to the
 * browser voice: an analyser measures the real amplitude and emits
 * "nova:voice-pulse" on each syllable-sized peak. Returns a cleanup function;
 * if Web Audio is unavailable the audio still plays untouched.
 */
function attachVoicePulses(audio: HTMLAudioElement): () => void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(ctx.destination); // keep the sound audible
    const data = new Uint8Array(analyser.frequencyBinCount);

    let raf = 0;
    let alive = true;
    let last = 0;
    const loop = () => {
      if (!alive) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      if (rms > 0.06 && now - last > 90) {
        last = now;
        window.dispatchEvent(new CustomEvent("nova:voice-pulse"));
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      void ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

/** Orchestrates a full assistant turn: states → API → apply → speak.
 *  Voice output streams from ElevenLabs (via /api/tts) so it starts sounding
 *  while it is still being synthesised, and falls back to the browser voice. */
export function useAssistant() {
  const tts = useMemo(() => (typeof window !== "undefined" ? new WebSpeechTTS() : null), []);
  const busy = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // null = unknown; probed once at mount so the first reply doesn't pay for it.
  const elevenReady = useRef<boolean | null>(null);
  const awaitingAnswer = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/tts")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d) => {
        if (alive) elevenReady.current = d.configured === true;
      })
      .catch(() => {
        if (alive) elevenReady.current = false;
      });
    return () => {
      alive = false;
    };
  }, []);

  const finishSpeaking = useCallback(() => {
    if (useNova.getState().novaState === "speaking") useNova.getState().setNovaState("idle");
    const detail = { awaitingAnswer: awaitingAnswer.current };
    awaitingAnswer.current = false;
    window.dispatchEvent(new CustomEvent(SPEECH_END_EVENT, { detail }));
  }, []);

  const speakWithBrowser = useCallback(
    (text: string) => {
      const st = useNova.getState();
      if (!tts?.available) {
        finishSpeaking();
        return;
      }
      tts.speak(text, {
        lang: st.settings.language,
        rate: st.settings.voiceRate,
        volume: st.settings.voiceVolume,
        voiceName: st.settings.voiceName,
        onBoundary: () => window.dispatchEvent(new CustomEvent("nova:voice-pulse")),
        onEnd: finishSpeaking,
      });
    },
    [tts, finishSpeaking],
  );

  const speak = useCallback(
    async (text: string) => {
      const st = useNova.getState();
      const clean = cleanForSpeech(text);
      if (!st.settings.voiceEnabled || !clean) {
        finishSpeaking();
        return;
      }
      st.setNovaState("speaking");

      if (elevenReady.current) {
        try {
          // A short reply rides in the query string, so the browser starts
          // playing the stream as it arrives instead of waiting for the whole
          // mp3. Long replies fall back to POST + blob.
          const q = encodeURIComponent(clean.slice(0, 2400));
          const voice = st.settings.ttsVoiceId;
          let src: string;
          let revoke: (() => void) | undefined;
          if (q.length < 1500) {
            src = `/api/tts?text=${q}${voice ? `&voice=${encodeURIComponent(voice)}` : ""}`;
          } else {
            const res = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: clean.slice(0, 2400), voice: voice ?? undefined }),
            });
            if (!res.ok || !res.headers.get("content-type")?.includes("audio")) {
              throw new Error("tts");
            }
            const blobUrl = URL.createObjectURL(await res.blob());
            src = blobUrl;
            revoke = () => URL.revokeObjectURL(blobUrl);
          }

          const audio = new Audio(src);
          audio.volume = useNova.getState().settings.voiceVolume;
          audioRef.current = audio;
          const stopPulses = attachVoicePulses(audio);
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            stopPulses();
            revoke?.();
            if (audioRef.current === audio) audioRef.current = null;
            finishSpeaking();
          };
          audio.onended = done;
          // A failed stream (bad key, quota) surfaces here: fall back once and
          // stop using ElevenLabs for the rest of the session.
          audio.onerror = () => {
            if (settled) return;
            settled = true;
            stopPulses();
            revoke?.();
            elevenReady.current = false;
            speakWithBrowser(clean);
          };
          await audio.play();
          return;
        } catch {
          elevenReady.current = false;
        }
      }
      speakWithBrowser(clean);
    },
    [speakWithBrowser, finishSpeaking],
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
        if (res.status === 401 || res.status === 402) {
          // Sesión caducada o prueba terminada: avisar claro y dejar que el
          // gate (AuthScreen/Paywall) tome el control al recargar.
          useNova.getState().applyTurn(
            {
              reply:
                res.status === 401
                  ? "Tu sesión ha caducado. Vuelve a iniciar sesión."
                  : "Tu periodo de prueba ha terminado. Suscríbete para seguir usando ZERO.",
              view: "home",
            },
            useNova.getState().demoMode,
          );
          useNova.getState().setNovaState("warning");
          setTimeout(() => window.location.reload(), 2200);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const turn = data.turn;

        // Reflect execution/planning visually before settling.
        if (turn.proposal) store.setNovaState("planning");
        else if (turn.receipts?.some((r: { kind: string }) => /create|update|delete|complete/.test(r.kind)))
          store.setNovaState("executing");

        useNova.getState().applyTurn(turn, data.demoMode);

        const anyFail = turn.receipts?.some((r: { ok: boolean }) => !r.ok);
        useNova.getState().setNovaState(anyFail ? "warning" : "success");
        awaitingAnswer.current = wantsAnswer(turn.reply ?? "", Boolean(turn.proposal));
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
    awaitingAnswer.current = false;
    if (useNova.getState().novaState === "speaking") useNova.getState().setNovaState("idle");
  }, [tts]);

  return { send, speak, stopSpeaking };
}
