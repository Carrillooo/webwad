"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  { key: "history", label: "Historial" },
];

/** The transforming holographic monitor. Drops from the top; each view builds
 *  in with blur/scale. */
export function Monitor({ onClose }: { onClose?: () => void }) {
  const view = useNova((s) => s.view);
  const setView = useNova((s) => s.setView);
  const View = VIEWS[view];

  const quieto = useReducedMotion();

  return (
    <div className="glass-raised relative h-full min-h-0 flex flex-col overflow-hidden">
      {/* Tab strip: la pastilla activa es UNA sola que se desliza entre
          pestañas. Antes cada botón encendía y apagaba su propio fondo y el
          salto no contaba de dónde a dónde ibas. */}
      <div className="flex items-center gap-1 px-3 pt-3 shrink-0">
        <nav
          className="flex gap-1 overflow-x-auto nova-scroll flex-1 scroll-edge-x"
          aria-label="Vistas de ZERO"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              aria-current={view === t.key ? "page" : undefined}
              className="relative text-[0.8rem] px-3.5 py-3 rounded-full whitespace-nowrap shrink-0"
              style={{ color: view === t.key ? "var(--fg)" : "var(--fg-faint)" }}
            >
              {view === t.key && (
                <motion.span
                  layoutId="tab-activa"
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgb(var(--nova-primary) / 0.16)" }}
                  transition={quieto ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </nav>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar monitor"
            className="text-faint hover:text-fg w-11 h-11 grid place-items-center rounded-full shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>

      <div className="relative flex-1 min-h-0 p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            // 220 ms: por encima de 300 una vista se percibe lenta aunque los
            // datos ya estén. El desenfoque tapa la costura del cruce.
            initial={{ opacity: 0, y: 6, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(8px)" }}
            transition={{ duration: quieto ? 0.12 : 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="absolute inset-4"
          >
            <View />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
