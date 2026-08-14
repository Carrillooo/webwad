"use client";
import { motion } from "motion/react";
import { useNova } from "@/lib/store";

const KIND_COLOR: Record<string, string> = {
  create: "var(--nova-accent)",
  update: "var(--nova-primary)",
  delete: "248 113 113",
  complete: "52 211 153",
};

function tint(kind: string): string {
  const k = Object.keys(KIND_COLOR).find((x) => kind.includes(x));
  return k ? KIND_COLOR[k] : "var(--nova-border)";
}

export function HistoryView() {
  const receipts = useNova((s) => s.receipts);
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-base font-medium mb-3">Actividad reciente</h2>
      <div className="flex-1 overflow-y-auto nova-scroll space-y-2 pr-1">
        {receipts.length === 0 && <p className="text-sm text-faint">Aún no hay acciones.</p>}
        {receipts.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="flex items-center gap-3 glass px-3 py-2"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `rgb(${tint(r.kind)})` }} />
            <span className="text-xs tabular-nums text-faint w-12">
              {new Date(r.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={`flex-1 text-sm ${r.ok ? "" : "text-[rgb(220,38,38)]"}`}>{r.label}</span>
            {r.undoable && <span className="text-[10px] text-faint">deshacer disp.</span>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
