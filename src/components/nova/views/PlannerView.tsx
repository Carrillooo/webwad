"use client";
import { motion } from "motion/react";
import { useNova } from "@/lib/store";
import { humanTime } from "@/lib/datetime";

/** Shows the current plan proposal awaiting confirmation. */
export function PlannerView() {
  const proposal = useNova((s) => s.pendingProposal);

  if (!proposal || !proposal.blocks?.length) {
    return (
      <div className="h-full grid place-items-center text-center">
        <div>
          <h2 className="text-base font-medium mb-1">Planificador</h2>
          <p className="text-sm text-faint max-w-xs">
            Dime, por ejemplo: “Mañana quiero estudiar una hora, trabajar dos horas y entrenar. Organízamelo sin mover mis compromisos.”
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-base font-medium mb-3">Propuesta de planificación</h2>
      <div className="flex-1 space-y-2 overflow-y-auto nova-scroll pr-1">
        {proposal.blocks.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass px-3 py-2.5 flex items-center gap-3"
            style={{ border: "1px dashed rgb(var(--nova-accent) / 0.6)" }}
          >
            <span className="text-xs tabular-nums text-dim w-24">
              {humanTime(b.start)}–{humanTime(b.end)}
            </span>
            <span className="text-sm">{b.title}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-faint mt-3">
        Di “Sí” para aplicar o “Busca otro” para reorganizar.
      </p>
    </div>
  );
}
