"use client";
import { useCallback, useEffect, useState } from "react";
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

/**
 * Lo último que ha dicho ZERO, ESCRITO.
 *
 * Hasta ahora `lastReply` se guardaba en el estado y no se pintaba en ningún
 * sitio: la única forma de enterarse era oírlo. Con el monitor cerrado —que es
 * como está casi siempre— quien pulsaba la piedra y se topaba con un problema
 * (micrófono bloqueado, por ejemplo) veía la palabra «Atención» debajo de la
 * piedra y nada más. Un asistente que no cuenta qué le pasa no sirve.
 *
 * Los avisos se quedan hasta que se cierran; una respuesta normal se va sola.
 */
function Respuesta({ onCerrar }: { onCerrar: () => void }) {
  const texto = useNova((s) => s.lastReply);
  const estado = useNova((s) => s.novaState);
  const aviso = estado === "warning" || estado === "error";

  useEffect(() => {
    if (!texto || aviso) return;
    const id = window.setTimeout(onCerrar, 12_000);
    return () => window.clearTimeout(id);
  }, [texto, aviso, onCerrar]);

  if (!texto) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.14 } }}
      transition={SUAVE}
      className="glass-solid rounded-2xl px-4 py-3 flex items-start gap-3"
      style={aviso ? { borderColor: "rgb(var(--warning) / 0.55)" } : undefined}
      role={aviso ? "alert" : "status"}
    >
      {aviso && (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--warning))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden>
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      )}
      <p className="flex-1 text-sm leading-relaxed max-h-52 overflow-y-auto nova-scroll">{texto}</p>
      <button
        onClick={onCerrar}
        aria-label="Cerrar mensaje"
        className="w-8 h-8 -mr-1 -mt-1 grid place-items-center rounded-full text-faint hover:text-fg shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </motion.div>
  );
}

export function Resting() {
  const panelOpen = useNova((s) => s.panelOpen);
  const novaState = useNova((s) => s.novaState);
  const lastReply = useNova((s) => s.lastReply);
  const [cerrado, setCerrado] = useState("");

  // Mientras ZERO escucha o piensa, la piedra se va al centro y ocupa la
  // pantalla: ahí no pinta nada más. Pero cuando responde, avisa o falla, esto
  // TIENE que poder verse.
  const enReposo = novaState === "idle";
  const conMensaje = novaState === "speaking" || novaState === "warning" || novaState === "error" || novaState === "success";
  const visible = !panelOpen && (enReposo || conMensaje);
  const mensajeVisible = Boolean(lastReply) && lastReply !== cerrado;
  const cerrar = useCallback(() => setCerrado(useNova.getState().lastReply), []);

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
          <AnimatePresence mode="wait">
            {mensajeVisible ? (
              <div key="msg" className="mt-4">
                <Respuesta onCerrar={cerrar} />
              </div>
            ) : (
              // Las sugerencias solo mientras no haya nada que leer: si no,
              // compiten con el mensaje justo cuando hay que leerlo.
              enReposo && (
                <motion.div key="chips" className="mt-6" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                  <Sugerencias />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
