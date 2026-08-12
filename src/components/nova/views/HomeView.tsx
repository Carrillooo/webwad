"use client";
import { motion } from "motion/react";
import { useBriefing } from "@/hooks/useBriefing";
import { humanTime } from "@/lib/datetime";

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
    <div className="h-full flex flex-col justify-center gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: i * 0.08 }}
            className="glass holo-border p-4"
          >
            <div className="text-[11px] uppercase tracking-wide text-faint">{c.label}</div>
            <div className="text-lg font-medium mt-1 glow-text truncate">{c.value}</div>
            <div className="text-xs text-dim">{c.sub}</div>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-xs text-faint">
        Prueba: “¿Qué tengo mañana?” · “Añádeme entrenamiento mañana a las 19:30 durante hora y media.”
      </p>
    </div>
  );
}
