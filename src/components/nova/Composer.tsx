"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNova } from "@/lib/store";

interface Props {
  onSend: (text: string) => void;
}

/**
 * Voice-first composer. The text input stays hidden behind a keyboard toggle
 * (bottom-right); transcript and proposals float at the bottom-center.
 * Cmd/Ctrl+K opens the input (accessibility: keyboard is always reachable).
 */
export function Composer({ onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const transcript = useNova((s) => s.transcript);
  const proposal = useNova((s) => s.pendingProposal);
  const novaState = useNova((s) => s.novaState);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    setValue("");
    onSend(t);
  };

  return (
    <>
      {/* Floating layer: transcript · proposal · (optional) input */}
      <div className="fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>
          {transcript && (novaState === "listening" || novaState === "transcribing") && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-dim italic max-w-md"
            >
              “{transcript}”
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {proposal && (
            <motion.div
              key="proposal"
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              // Salir siempre más rápido que entrar: al decidir se mira, al
              // confirmar ya no hay nada que leer.
              exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
              transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
              className="glass-raised holo-border p-3 flex items-center gap-2.5 w-full max-w-md pointer-events-auto"
              data-active="true"
            >
              <span className="flex-1 text-sm">{proposal.summary}</span>
              <button
                onClick={() => onSend("Sí")}
                className="px-3.5 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "rgb(var(--nova-accent))" }}
              >
                {proposal.risk === "high" ? "Confirmar" : "Aplicar"}
              </button>
              <button onClick={() => onSend("No, cancela")} className="px-3 py-2 rounded-xl text-sm text-dim">
                Descartar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {open && (
            <motion.div
              key="input"
              // Crece DESDE el botón del teclado (abajo a la derecha), no
              // desde su propio centro: así se ve de dónde ha salido, y al
              // cerrarlo vuelve por el mismo sitio.
              style={{ transformOrigin: "bottom right" }}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, opacity: { duration: 0.16 } }}
              className="glass-raised flex items-center gap-2 px-3 py-2 w-full max-w-md pointer-events-auto"
            >
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Escribe una orden a ZERO…"
                aria-label="Entrada de texto para ZERO"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-faint min-w-0"
              />
              <button onClick={submit} aria-label="Enviar" className="text-dim hover:text-fg disabled:opacity-40" disabled={!value.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
              <button onClick={() => setOpen(false)} aria-label="Ocultar teclado" className="text-faint hover:text-fg text-lg leading-none">
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard toggle — bottom-right, mirrors the core bottom-left. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Escribir a ZERO"
          className="fixed bottom-5 right-4 glass hover-lift w-11 h-11 grid place-items-center text-dim hover:text-fg z-40 rounded-full"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
          </svg>
        </button>
      )}
    </>
  );
}
