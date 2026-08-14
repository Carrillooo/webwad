"use client";
import { motion } from "motion/react";
import { useTasksData } from "@/hooks/useNovaData";

export function TasksView() {
  const { tasks, loading, reload } = useTasksData();
  const pending = tasks.filter((t) => t.status === "needsAction");
  const done = tasks.filter((t) => t.status === "completed");

  async function toggle(id: string, complete: boolean) {
    // Optimistic UI is skipped; the API mutates the shared demo store.
    await fetch("/api/tasks/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: complete ? "complete" : "reopen", id }),
    });
    reload();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium">Tareas</h2>
        <span className="text-xs text-faint">{pending.length} pendientes</span>
      </div>
      <div className="flex-1 overflow-y-auto nova-scroll space-y-2 pr-1">
        {pending.map((t, i) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id, true)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="w-full text-left glass holo-border px-3 py-2.5 flex items-center gap-3 hover:bg-white/5"
          >
            <span className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: "rgb(var(--nova-accent) / 0.6)" }} />
            <span className="flex-1 text-sm">{t.title}</span>
            {t.due && <span className="text-[10px] text-faint tabular-nums">{t.due.slice(5)}</span>}
          </motion.button>
        ))}
        {done.length > 0 && <p className="text-[11px] text-faint pt-2 pl-1">Completadas</p>}
        {done.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id, false)}
            className="w-full text-left px-3 py-2 flex items-center gap-3 opacity-50 hover:opacity-70"
          >
            <span className="w-4 h-4 rounded-full grid place-items-center shrink-0" style={{ background: "rgba(52,211,153,0.25)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(5 150 105)" strokeWidth="3">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span className="flex-1 text-sm line-through">{t.title}</span>
          </button>
        ))}
        {!loading && pending.length === 0 && done.length === 0 && (
          <p className="text-sm text-faint">No hay tareas.</p>
        )}
      </div>
    </div>
  );
}
