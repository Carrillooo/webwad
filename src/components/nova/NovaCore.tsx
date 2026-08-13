"use client";
import { useEffect, useId, useState } from "react";
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

interface Props {
  level: number;
  onActivate: () => void;
  disabled?: boolean;
  showHint?: boolean;
  onActivateHelp?: string;
}

/** ZERO's reactive obsidian crystal. */
export function NovaCore({ level, onActivate, onActivateHelp, disabled, showHint = true }: Props) {
  const state = useNova((s) => s.novaState);
  const label = STATE_LABEL[state];
  const listening = state === "listening" || state === "transcribing";
  const speaking = state === "speaking";
  const busy = state === "thinking" || state === "planning" || state === "executing";
  const [voicePulse, setVoicePulse] = useState(0);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    if (!speaking) {
      setVoicePulse(0);
      return;
    }
    const pulse = () => {
      setVoicePulse(1);
      window.setTimeout(() => setVoicePulse(0), 115);
    };
    window.addEventListener("nova:voice-pulse", pulse);
    return () => window.removeEventListener("nova:voice-pulse", pulse);
  }, [speaking]);

  const energy = listening ? Math.max(0.08, level) : speaking ? 0.42 + voicePulse * 0.58 : busy ? 0.3 : 0.08;
  const crystalStyle = {
    ["--crystal-energy" as string]: energy.toFixed(3),
    ["--crystal-level" as string]: level.toFixed(3),
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ width: 240 }}>
      <button
        type="button"
        aria-label={state !== "idle" ? label || "ZERO activa" : "Hablar con ZERO"}
        aria-pressed={listening}
        title={onActivateHelp}
        onClick={onActivate}
        disabled={disabled}
        className="crystal-button disabled:opacity-60"
        data-state={state}
        style={crystalStyle}
      >
        <span aria-hidden className="crystal-aura" />
        <span aria-hidden className="crystal-shadow" />
        <svg aria-hidden className="crystal-gem" viewBox="0 0 220 260" role="presentation">
          <defs>
            <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#eef2ff" stopOpacity=".92" />
              <stop offset=".08" stopColor="#5e6478" stopOpacity=".7" />
              <stop offset=".26" stopColor="#090a11" />
              <stop offset=".63" stopColor="#020207" />
              <stop offset=".84" stopColor="#17192b" />
              <stop offset="1" stopColor="#030307" />
            </linearGradient>
            <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
              <stop offset=".35" stopColor="#aeb7d4" stopOpacity=".38" />
              <stop offset="1" stopColor="#31354d" stopOpacity=".08" />
            </linearGradient>
            <radialGradient id={`${uid}-core`} cx="50%" cy="46%" r="56%">
              <stop offset="0" stopColor="rgb(var(--nova-accent))" stopOpacity=".9" />
              <stop offset=".28" stopColor="rgb(var(--nova-primary))" stopOpacity=".5" />
              <stop offset=".7" stopColor="#5f62ff" stopOpacity=".13" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <filter id={`${uid}-soft`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <clipPath id={`${uid}-clip`}>
              <path d="M110 5 177 67 205 151 165 225 110 256 55 225 15 151 43 67Z" />
            </clipPath>
          </defs>

          <path className="crystal-shell" d="M110 5 177 67 205 151 165 225 110 256 55 225 15 151 43 67Z" fill={`url(#${uid}-body)`} stroke={`url(#${uid}-edge)`} strokeWidth="1.4" />
          <ellipse className="crystal-core-light" cx="112" cy="137" rx="70" ry="82" fill={`url(#${uid}-core)`} filter={`url(#${uid}-soft)`} clipPath={`url(#${uid}-clip)`} />

          <g className="crystal-facets" clipPath={`url(#${uid}-clip)`}>
            <path d="M110 5 86 78 43 67Z" fill="#dce4ff" fillOpacity=".16" />
            <path d="M110 5 136 77 177 67Z" fill="#090a14" fillOpacity=".82" />
            <path d="M43 67 86 78 58 151 15 151Z" fill="#1a1c2b" fillOpacity=".68" />
            <path d="M86 78 110 5 136 77 112 130Z" fill="#03040a" fillOpacity=".72" />
            <path d="M136 77 177 67 205 151 163 144Z" fill="#151725" fillOpacity=".78" />
            <path d="M58 151 112 130 89 207 55 225Z" fill="#05050c" fillOpacity=".84" />
            <path d="M112 130 163 144 165 225 89 207Z" fill="#0d0e18" fillOpacity=".78" />
            <path d="M89 207 165 225 110 256 55 225Z" fill="#030308" fillOpacity=".9" />
            <path d="M54 71 90 24 79 84 46 126" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M151 55 175 93 184 141" fill="none" stroke="#cdd5ff" strokeOpacity=".3" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M72 172 106 144 94 193" fill="none" stroke="#7c83a6" strokeOpacity=".32" strokeWidth="1.1" />
            <path d="M119 105 145 90 154 124" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.1" />
          </g>

          <path className="crystal-rim" d="M110 5 177 67 205 151 165 225 110 256 55 225 15 151 43 67Z" fill="none" stroke="rgb(var(--nova-accent))" strokeOpacity=".18" strokeWidth="2" />
        </svg>
      </button>

      <div className="h-5 text-sm" aria-live="polite" style={{ opacity: showHint ? 1 : 0, transition: "opacity .25s" }}>
        {label ? <span className="glow-text">{label}</span> : <span className="text-faint">Pulsa para hablar</span>}
      </div>
    </div>
  );
}
