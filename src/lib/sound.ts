"use client";
import { useNova } from "./store";

/**
 * Short sci-fi blip when ZERO starts listening. Respects Ajustes → sonidos and
 * fails silently when the browser blocks audio (no user gesture yet).
 */
export function playActivationBeep(): void {
  if (typeof window === "undefined") return;
  if (!useNova.getState().settings.sounds) return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1180, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => void ctx.close().catch(() => {});
  } catch {
    /* audio unavailable → silent activation */
  }
}
