"use client";
import { motion } from "motion/react";
import { useBriefing } from "@/hooks/useBriefing";
import { humanTime } from "@/lib/datetime";
import { ASK_EVENT } from "@/lib/events";

/** Atajos: quien abre ZERO por primera vez mira la piedra y no sabe qué decir.
 *  Un toque aquí equivale a decirlo en voz alta. */
const ATAJOS = [
  "¿Qué tengo hoy?",
  "¿Qué huecos tengo mañana?",
  "Añádeme una tarea",
  "Resume mi día",
];

function Atajos() {
  return (
    <div className="flex flex-wrap justify-center gap-2" aria-label="Sugerencias">
      {ATAJOS.map((t, i) => (
        <motion.button
          key={t}
          onClick={() => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: t }))}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          // Los atajos entran DESPUÉS de las tarjetas y en cascada corta: se
          // lee de arriba abajo, como se mira.
          transition={{ delay: 0.16 + i * 0.04, duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          className="glass-solid px-3.5 py-2 rounded-full text-xs text-dim hover:text-fg"
        >
          {t}
        </motion.button>
      ))}
    </div>
  );
}

/** Calm resting view. A few high-signal cards, never crowded. */
export function HomeView() {
  const b = useBriefing();
  const pending = b?.tasks.length ?? 0;

  const cards = [
    {
      label: "Próximo evento",
      value: b?.nextEvent ? b.nextEvent.title : "Sin eventos",
      sub: b?.nextEvent ? humanTime(b.nextEvent.start) : "Día despejado",
    },
    {
      label: "Tareas pendientes",
      value: `${pending}`,
      sub: pending === 1 ? "tarea" : "tareas",
    },
    {
      label: "Siguiente hueco",
      value: b?.mainFreeSlot ? `${humanTime(b.mainFreeSlot.start)}–${humanTime(b.mainFreeSlot.end)}` : "—",
      sub: b?.mainFreeSlot ? `${Math.round(b.mainFreeSlot.minutes / 60)} h libres` : "Sin huecos",
    },
  ];

  return (
    // Con el monitor abierto la piedra se recoge a una esquina, así que ya no
    // hace falta el colchón de 200 px que antes dejaba media vista vacía.
    // En móvil el panel es mucho más alto que su contenido: centrar dejaba las
    // tarjetas flotando en un vacío. Arriba se leen; en escritorio, donde el
    // panel y el contenido se parecen, sí se centran.
    <div className="h-full flex flex-col justify-start sm:justify-center gap-5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            // 45 ms entre tarjetas: se nota la cascada sin que la vista
            // tarde en estar entera.
            transition={{ delay: i * 0.045, duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
            className="glass-solid hover-lift p-4"
          >
            <div className="text-[0.68rem] uppercase t-label text-faint">{c.label}</div>
            {/* El dato es lo que se viene a leer: manda en tamaño y peso. */}
            <div className="text-[1.35rem] font-semibold t-title mt-1.5 truncate">{c.value}</div>
            <div className="text-xs text-dim mt-0.5">{c.sub}</div>
          </motion.div>
        ))}
      </div>
      <Atajos />
    </div>
  );
}
