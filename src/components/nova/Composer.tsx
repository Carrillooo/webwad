"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNova } from "@/lib/store";

interface Props {
  onSend: (text: string) => void;
}

/** Always-available keyboard input + proposal confirm/cancel + Cmd/Ctrl+K. */
export function Composer({ onSend }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const transcript = useNova((s) => s.transcript);
  const proposal = useNova((s) => s.pendingProposal);
  const novaState = useNova((s) => s.novaState);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    setValue("");
    onSend(t);
  };

  return (
    <div className="px-4 pb-4 pt-1 space-y-2">
      <AnimatePresence>
        {transcript && (novaState === "listening" || novaState === "transcribing") && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm text-dim italic"
          >
            “{transcript}”
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {proposal && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass holo-border p-3 flex items-center gap-3"
          >
            <span className="flex-1 text-sm">{proposal.summary}</span>
            <button onClick={() => onSend("Sí")} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "rgb(var(--nova-accent) / 0.22)" }}>
              {proposal.risk === "high" ? "Confirmar" : "Aplicar"}
            </button>
            <button onClick={() => onSend("No, cancela")} className="px-3 py-1.5 rounded-lg text-sm text-dim">
              Descartar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass holo-border flex items-center gap-2 px-3 py-2">
        <span className="text-faint text-xs hidden sm:inline">⌘K</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Escribe una orden…  p. ej. “mañana entrenamiento 19:30 90 min”"
          aria-label="Entrada de texto para ZERO"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-faint"
        />
        <button onClick={submit} aria-label="Enviar" className="text-dim hover:text-fg" disabled={!value.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}
