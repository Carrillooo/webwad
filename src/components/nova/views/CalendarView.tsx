"use client";
import { motion } from "motion/react";
import { useNova } from "@/lib/store";
import { useCalendarData } from "@/hooks/useNovaData";
import { humanTime, humanDay } from "@/lib/datetime";

const DAY_START = 7; // 07:00
const DAY_END = 23; // 23:00
const HOURS = DAY_END - DAY_START;

/** Day timeline with holographic event blocks. Reflects focusDate. */
export function CalendarView() {
  const focusDate = useNova((s) => s.focusDate);
  const pendingProposal = useNova((s) => s.pendingProposal);
  const { events, loading } = useCalendarData(focusDate);
  const day = focusDate ? new Date(focusDate) : new Date();

  const proposalBlocks = pendingProposal?.blocks ?? [];

  const pos = (iso: string) => {
    const d = new Date(iso);
    const mins = d.getHours() * 60 + d.getMinutes();
    return ((mins - DAY_START * 60) / (HOURS * 60)) * 100;
  };
  const height = (s: string, e: string) => {
    const dur = (new Date(e).getTime() - new Date(s).getTime()) / 60000;
    return Math.max(3.5, (dur / (HOURS * 60)) * 100);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium capitalize">{humanDay(day)}</h2>
        <span className="text-xs text-faint">{events.length} eventos</span>
      </div>

      <div className="relative flex-1 overflow-y-auto nova-scroll pr-1">
        <div className="relative" style={{ height: `${HOURS * 56}px` }}>
          {/* Hour grid */}
          {Array.from({ length: HOURS + 1 }).map((_, i) => (
            <div key={i} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: `${(i / HOURS) * 100}%` }}>
              <span className="text-[10px] text-faint w-9 tabular-nums">
                {String(DAY_START + i).padStart(2, "0")}:00
              </span>
              <span className="flex-1 h-px" style={{ background: "rgb(var(--nova-border) / 0.10)" }} />
            </div>
          ))}

          {/* Proposal ghost blocks (translucent, not yet solid) */}
          {proposalBlocks.map((b, i) => (
            <motion.div
              key={`p-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.75, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute left-12 right-2 rounded-xl px-3 py-1 text-xs"
              style={{
                top: `${pos(b.start)}%`,
                height: `${height(b.start, b.end)}%`,
                border: "1px dashed rgb(var(--nova-accent) / 0.7)",
                background: "rgb(var(--nova-accent) / 0.10)",
              }}
            >
              <span className="opacity-80">{b.title} · propuesto</span>
            </motion.div>
          ))}

          {/* Confirmed events */}
          {events.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="absolute left-12 right-2 rounded-xl px-3 py-1.5 overflow-hidden holo-border"
              style={{
                top: `${pos(e.start)}%`,
                height: `${height(e.start, e.end)}%`,
                background: "rgb(var(--nova-primary) / 0.16)",
                boxShadow: "0 0 20px rgb(var(--nova-primary) / calc(0.25 * var(--nova-glow)))",
              }}
            >
              <div className="text-sm font-medium truncate">{e.title}</div>
              <div className="text-[11px] text-dim tabular-nums">
                {humanTime(e.start)}–{humanTime(e.end)}
                {e.location ? ` · ${e.location}` : ""}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {loading && <p className="text-xs text-faint mt-2">Cargando agenda…</p>}
    </div>
  );
}
