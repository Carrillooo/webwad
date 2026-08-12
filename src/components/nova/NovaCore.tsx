"use client";
import { motion } from "motion/react";
import { useNova, type NovaState } from "@/lib/store";

const STATE_LABEL: Record<NovaState, string> = {
  idle: "",
  listening: "Te escucho…",
  transcribing: "Transcribiendo…",
  thinking: "Analizando…",
  planning: "Planificando…",
  executing: "Ejecutando…",
  speaking: "Hablando…",
  success: "Hecho",
  warning: "Atención",
  error: "Error",
};

const STATE_TINT: Record<NovaState, string> = {
  idle: "var(--nova-core)",
  listening: "var(--nova-accent)",
  transcribing: "var(--nova-accent)",
  thinking: "var(--nova-primary)",
  planning: "var(--nova-primary)",
  executing: "var(--nova-primary)",
  speaking: "var(--nova-accent)",
  success: "52 211 153",
  warning: "251 191 36",
  error: "248 113 113",
};

interface Props {
  level: number; // 0..1 mic amplitude
  onActivate: () => void;
  disabled?: boolean;
}

/**
 * The living core of ZERO — an energy sphere, not "a circle with a mic icon".
 * Layers: outer aura, orbiting particles, rotating rings, glass nucleus.
 * Reacts to real mic amplitude while listening and pulses per state.
 */
export function NovaCore({ level, onActivate, onActivateHelp, disabled }: Props & { onActivateHelp?: string }) {
  const state = useNova((s) => s.novaState);
  const tint = STATE_TINT[state];
  const label = STATE_LABEL[state];
  const listening = state === "listening" || state === "transcribing";
  const active = state !== "idle";

  // Amplitude-driven expansion while listening; gentle per-state otherwise.
  const amp = listening ? 1 + level * 0.5 : 1;
  const busy = state === "thinking" || state === "planning" || state === "executing";

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <button
        type="button"
        aria-label={active ? label || "ZERO activa" : "Hablar con ZERO"}
        aria-pressed={listening}
        title={onActivateHelp}
        onClick={onActivate}
        disabled={disabled}
        className="relative grid place-items-center rounded-full outline-none disabled:opacity-60"
        style={{ width: 168, height: 168 }}
      >
        {/* Outer aura */}
        <motion.span
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 168,
            height: 168,
            background: `radial-gradient(circle, rgb(${tint} / ${0.28}) 0%, transparent 68%)`,
            filter: "blur(6px)",
          }}
          animate={{ scale: [1, 1.08 * amp, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: busy ? 1.4 : 3.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Rotating rings */}
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: 132 - i * 34,
              height: 132 - i * 34,
              border: `1px solid rgb(${tint} / ${0.5 - i * 0.15})`,
              borderTopColor: `rgb(${tint} / 0.95)`,
            }}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: busy ? 3 + i : 10 + i * 4, repeat: Infinity, ease: "linear" }}
          />
        ))}

        {/* Orbiting particles */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute"
            style={{
              width: 4,
              height: 4,
              borderRadius: 9999,
              background: `rgb(${tint})`,
              boxShadow: `0 0 8px rgb(${tint})`,
              opacity: `calc(0.8 * var(--nova-particles))`,
            }}
            animate={{
              rotate: 360,
              x: [0, Math.cos((i / 6) * Math.PI * 2) * 66],
              y: [0, Math.sin((i / 6) * Math.PI * 2) * 66],
            }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "linear" }}
          />
        ))}

        {/* Glass nucleus */}
        <motion.span
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 70,
            height: 70,
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), rgb(${tint} / 0.85) 40%, rgb(${tint} / 0.35) 100%)`,
            boxShadow: `0 0 calc(40px * var(--nova-glow)) rgb(${tint} / 0.75), inset 0 0 18px rgba(255,255,255,0.35)`,
          }}
          animate={{ scale: listening ? amp : [1, 1.06, 1] }}
          transition={
            listening
              ? { type: "spring", stiffness: 200, damping: 12 }
              : { duration: busy ? 1 : 3.4, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </button>

      <div className="h-5 text-sm" aria-live="polite">
        {label ? (
          <span style={{ color: `rgb(${tint})` }} className="glow-text">
            {label}
          </span>
        ) : (
          <span className="text-faint">Pulsa para hablar</span>
        )}
      </div>
    </div>
  );
}
