"use client";
import { motion } from "motion/react";
import { useBriefing } from "@/hooks/useBriefing";
import { humanTime } from "@/lib/datetime";

export function BriefingView() {
  const b = useBriefing();
  return (
    <div className="h-full overflow-y-auto nova-scroll">
      <h2 className="text-base font-medium mb-3">Tu briefing de hoy</h2>
      <div className="space-y-4">
        <section>
          <h3 className="text-[11px] uppercase tracking-wide text-faint mb-2">Timeline</h3>
          <div className="space-y-2">
            {(b?.events ?? []).map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="text-xs tabular-nums w-12 text-dim">{humanTime(e.start)}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--nova-accent))" }} />
                <span className="text-sm">{e.title}</span>
              </motion.div>
            ))}
            {(!b || b.events.length === 0) && <p className="text-sm text-faint">Sin eventos hoy.</p>}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass holo-border p-3">
            <div className="text-[11px] text-faint">Tareas</div>
            <div className="text-lg font-medium">{b?.tasks.length ?? 0}</div>
          </div>
          <div className="glass holo-border p-3">
            <div className="text-[11px] text-faint">Hueco principal</div>
            <div className="text-sm font-medium">
              {b?.mainFreeSlot ? `${humanTime(b.mainFreeSlot.start)}–${humanTime(b.mainFreeSlot.end)}` : "—"}
            </div>
          </div>
        </div>

        {b?.tasks && b.tasks.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-faint mb-2">Prioridades</h3>
            <ul className="space-y-1">
              {b.tasks.slice(0, 4).map((t) => (
                <li key={t.id} className="text-sm text-dim">• {t.title}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
