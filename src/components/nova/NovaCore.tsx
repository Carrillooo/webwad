"use client";

import { useNova, type NovaState } from "@/lib/store";
import { FuturisticVoiceCore } from "@/components/ui/hero-futuristic";

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
  level: number;
  onActivate: () => void;
  disabled?: boolean;
  showHint?: boolean;
  onActivateHelp?: string;
}

/** ZERO's visual voice core. It preserves the original interaction contract
 * while replacing the KITT bar with the reactive WebGPU stone. */
export function NovaCore({ level, onActivate, onActivateHelp, disabled, showHint = true }: Props) {
  const state = useNova((s) => s.novaState);
  const tint = STATE_TINT[state];
  const label = STATE_LABEL[state];

  return (
    <div className="flex w-[240px] select-none flex-col items-center gap-1.5">
      <FuturisticVoiceCore
        state={state}
        level={level}
        onActivate={onActivate}
        disabled={disabled}
        title={onActivateHelp}
      />

      <div
        className="h-5 text-sm"
        aria-live="polite"
        style={{ opacity: showHint ? 1 : 0, transition: "opacity .25s" }}
      >
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
