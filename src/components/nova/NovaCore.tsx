"use client";
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
  /** Hide the caption when the scanner is parked in its corner. */
  showHint?: boolean;
}

/**
 * ZERO's voice scanner — a KITT-style light bar (Knight Rider), not a circle.
 * A red beam sweeps left↔right while idle; while listening it locks to the
 * center and its width/intensity follows the REAL mic amplitude; while
 * thinking it sweeps fast; while speaking it pulses like speech.
 * The whole bar is the push-to-talk button.
 */
export function NovaCore({ level, onActivate, onActivateHelp, disabled, showHint = true }: Props & { onActivateHelp?: string }) {
  const state = useNova((s) => s.novaState);
  const tint = STATE_TINT[state];
  const label = STATE_LABEL[state];
  const listening = state === "listening" || state === "transcribing";
  const busy = state === "thinking" || state === "planning" || state === "executing";
  const speaking = state === "speaking";

  // While listening, the beam breathes with the real mic level.
  const beamWidth = listening ? 26 + level * 64 : undefined; // % of the bar

  return (
    <div className="flex flex-col items-center gap-2.5 select-none" style={{ width: 240 }}>
      <button
        type="button"
        aria-label={state !== "idle" ? label || "ZERO activa" : "Hablar con ZERO"}
        aria-pressed={listening}
        title={onActivateHelp}
        onClick={onActivate}
        disabled={disabled}
        className="kitt-frame glass disabled:opacity-60"
        data-state={state}
        style={{ ["--kitt-tint" as string]: tint }}
      >
        {/* Segment housing (LED strip look) */}
        <span aria-hidden className="kitt-track">
          {/* Sweeping / reacting beam */}
          <span
            className={`kitt-beam ${listening ? "kitt-beam--listen" : busy ? "kitt-beam--busy" : speaking ? "kitt-beam--talk" : "kitt-beam--idle"}`}
            style={listening ? { width: `${beamWidth}%`, opacity: 0.75 + level * 0.25 } : undefined}
          />
          {/* Secondary faint echo beam for depth */}
          <span className={`kitt-beam kitt-beam--echo ${busy ? "kitt-beam--busy" : "kitt-beam--idle"}`} />
        </span>
        {/* Center notch, like KITT's sensor */}
        <span aria-hidden className="kitt-notch" />
      </button>

      <div className="h-5 text-sm" aria-live="polite" style={{ opacity: showHint ? 1 : 0, transition: "opacity .25s" }}>
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
