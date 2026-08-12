"use client";
import { AnimatePresence, motion } from "motion/react";
import { useNova, type MonitorView } from "@/lib/store";
import { HomeView } from "./views/HomeView";
import { CalendarView } from "./views/CalendarView";
import { TasksView } from "./views/TasksView";
import { DocumentsView } from "./views/DocumentsView";
import { PlannerView } from "./views/PlannerView";
import { BriefingView } from "./views/BriefingView";
import { HistoryView } from "./views/HistoryView";

const VIEWS: Record<MonitorView, React.ComponentType> = {
  home: HomeView,
  calendar: CalendarView,
  tasks: TasksView,
  documents: DocumentsView,
  planner: PlannerView,
  briefing: BriefingView,
  history: HistoryView,
};

const TABS: { key: MonitorView; label: string }[] = [
  { key: "home", label: "Inicio" },
  { key: "calendar", label: "Calendario" },
  { key: "tasks", label: "Tareas" },
  { key: "planner", label: "Planner" },
  { key: "documents", label: "Docs" },
  { key: "briefing", label: "Briefing" },
  { key: "history", label: "Actividad" },
];

/** The transforming holographic monitor. Drops from the top; each view builds
 *  in with blur/scale. */
export function Monitor({ onClose }: { onClose?: () => void }) {
  const view = useNova((s) => s.view);
  const setView = useNova((s) => s.setView);
  const View = VIEWS[view];

  return (
    <div className="glass holo-border relative h-full min-h-0 flex flex-col overflow-hidden">
      {/* scanline sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--nova-primary) / 0.06), transparent 30%, transparent 70%, rgb(var(--nova-accent) / 0.05))",
        }}
      />

      {/* Tab strip */}
      <div className="flex items-center gap-1 px-3 pt-3 shrink-0">
        <nav className="flex gap-1 overflow-x-auto nova-scroll flex-1" aria-label="Vistas de ZERO">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              aria-current={view === t.key}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
              style={
                view === t.key
                  ? { background: "rgb(var(--nova-primary) / 0.22)", color: "var(--fg)" }
                  : { color: "var(--fg-faint)" }
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar monitor"
            className="text-dim hover:text-fg text-lg leading-none px-2 shrink-0"
          >
            ×
          </button>
        )}
      </div>

      <div className="relative flex-1 min-h-0 p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.01, filter: "blur(10px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-4"
          >
            <View />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
