"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Real microphone amplitude via Web Audio API, for the core visualizer.
 * Returns a 0..1 level and start/stop controls. Never records/persists audio.
 */
/** Por qué no arrancó el micro, para poder explicárselo al usuario. */
export type MicFail = "denied" | "unsupported" | "nomic" | "error";

export function useMicLevel() {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async (): Promise<true | MicFail> => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      return "unsupported";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel((prev) => prev * 0.6 + Math.min(1, rms * 3) * 0.4);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      return true;
    } catch (e) {
      const name = (e as Error).name;
      // NotAllowed = bloqueado (por el usuario, el navegador o el sistema);
      // NotFound = no hay micrófono. El navegador NO vuelve a preguntar si el
      // permiso quedó bloqueado — por eso hay que decirlo en pantalla.
      const kind: MicFail =
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "nomic"
            : "error";
      setError(kind);
      stop();
      return kind;
    }
  }, [stop]);

  return { level, error, start, stop };
}
