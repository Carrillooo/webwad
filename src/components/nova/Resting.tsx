"use client";
import { motion, AnimatePresence } from "motion/react";
import { useNova } from "@/lib/store";
import { useBriefing } from "@/hooks/useBriefing";
import { humanTime } from "@/lib/datetime";
import { ASK_EVENT } from "@/lib/events";

/**
 * La capa de reposo: lo que se ve cuando el monitor está cerrado.
 *
 * Antes esta pantalla eran 500 px de nada entre el saludo y la piedra. Quien
 * abría ZERO por primera vez veía una roca negra y no sabía ni qué tenía hoy
 * ni qué podía decirle. Aquí van las dos respuestas, en voz baja:
 *
 *   · una línea con el día, que al pulsarla abre el monitor;
 *   · tres cosas que se le pueden pedir, justo encima de la piedra.
 *
 * Nada de esto compite con el cristal: es texto tranquilo y píldoras finas.
 */

const SUGERENCIAS = ["¿Qué tengo hoy?", "¿Qué huecos tengo mañana?", "Resume mi día"];

const SUAVE = { duration: 0.3, ease: [0.23, 1, 0.32, 1] } as const;

function Resumen() {
  const b = useBriefing();
  const setPanelOpen = useNova((s) => s.setPanelOpen);
  if (!b) return null;

  const tareas = b.tasks.length;
  const partes = [
    b.nextEvent ? `${b.nextEvent.title} · ${humanTime(b.nextEvent.start)}` : "Sin eventos por delante",
    tareas > 0 ? `${tareas} ${tareas === 1 ? "tarea" : "tareas"}` : null,
  ].filter(Boolean) as string[];

  return (
    <motion.button
      type="button"
      onClick={() => setPanelOpen(true)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SUAVE, delay: 0.1 }}
      className="flex items-center gap-2 text-sm text-dim max-w-full"
      data-press="soft"
    >
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "rgb(var(--nova-accent))" }} />
      <span className="truncate">{partes.join("  ·  ")}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-faint shrink-0">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </motion.button>
  );
}

function Sugerencias() {
  return (
    // Alineadas a la izquierda, como el saludo: se leen en la misma columna
    // en vez de flotar centradas en mitad de la pantalla.
    <div className="flex flex-wrap gap-2" aria-label="Cosas que puedes pedirle">
      {SUGERENCIAS.map((t, i) => (
        <motion.button
          key={t}
          onClick={() => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: t }))}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SUAVE, delay: 0.18 + i * 0.045 }}
          className="glass-solid px-3.5 py-2 rounded-full text-xs text-dim hover:text-fg"
        >
          {t}
        </motion.button>
      ))}
    </div>
  );
}

export function Resting() {
  const panelOpen = useNova((s) => s.panelOpen);
  const novaState = useNova((s) => s.novaState);
  // Mientras ZERO escucha o piensa, la piedra se va al centro y ocupa la
  // pantalla: aquí no pinta nada más.
  const visible = !panelOpen && novaState === "idle";

  return (
    <AnimatePresence>
      {visible && (
        // EN FLUJO, justo debajo de la cabecera — no flotando con márgenes
        // fijos. La versión anterior iba `fixed` con separaciones en rem y en
        // un iPhone de verdad se descolocaba: la línea del día se subía por
        // encima del saludo (el `fixed` ignora el hueco del notch, que sí
        // desplaza la cabecera) y las sugerencias acababan pisando la piedra.
        // Colocado en flujo, la separación la decide el propio contenido y
        // aguanta cualquier pantalla, notch y tamaño de letra.
        <motion.div
          key="reposo"
          className="relative z-10 px-5 pt-3 max-w-3xl mx-auto w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
        >
          <Resumen />
          <div className="mt-6">
            <Sugerencias />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
