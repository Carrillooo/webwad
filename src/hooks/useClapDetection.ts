"use client";
import { useEffect, useRef } from "react";

/**
 * Double-clap activation ("estilo JARVIS"): keeps the mic open (only while
 * enabled AND ZERO is idle), tracks a rolling noise floor, and fires when two
 * sharp transients land 120–700 ms apart. Releases the microphone whenever it
 * unmounts so it never fights SpeechRecognition. Nothing is recorded.
 */
export function useClapDetection(enabled: boolean, onDoubleClap: () => void) {
  const cbRef = useRef(onDoubleClap);
  useEffect(() => {
    cbRef.current = onDoubleClap;
  }, [onDoubleClap]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    let alive = true;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        let noise = 0.01; // rolling noise floor
        let lastClap = 0;
        let cooldownUntil = 0;

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
          noise = noise * 0.995 + rms * 0.005;

          const threshold = Math.max(0.09, noise * 4.5);
          if (now > cooldownUntil && rms > threshold) {
            if (lastClap && now - lastClap > 120 && now - lastClap < 700) {
              // Second clap → fire and cool down so speech doesn't retrigger.
              lastClap = 0;
              cooldownUntil = now + 2000;
              cbRef.current();
            } else {
              lastClap = now;
            }
            cooldownUntil = Math.max(cooldownUntil, now + 130);
          }
          if (lastClap && now - lastClap > 900) lastClap = 0;
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* mic denied/unavailable → clap activation silently off */
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [enabled]);
}
