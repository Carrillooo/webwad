"use client";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
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

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: { role: "user" | "assistant"; content: string; at: string }[];
}

/** "hoy", "ayer" o la fecha corta: cómo lo diría una persona. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const dias = Math.floor(
    (Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) -
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) /
      86_400_000,
  );
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (dias === 0) return `Hoy · ${hora}`;
  if (dias === 1) return `Ayer · ${hora}`;
  return `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${hora}`;
}

function Conversations() {
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/conversations");
      const d = await r.json();
      setConvos(d.conversations ?? []);
    } catch {
      setConvos([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (convos === null) return <p className="text-sm text-faint">Cargando…</p>;
  if (convos.length === 0) {
    return <p className="text-sm text-faint">Aún no has hablado con ZERO. Lo que le digas quedará aquí.</p>;
  }

  return (
    <div className="space-y-2">
      {convos.map((c, i) => {
        const abierta = openId === c.id;
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="glass rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpenId(abierta ? null : c.id)}
              aria-expanded={abierta}
              className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="block text-sm truncate">{c.title}</span>
                <span className="block text-[11px] text-faint">
                  {whenLabel(c.updatedAt)} · {c.messages.length} mensajes
                </span>
              </span>
              {/* Un chevrón que gira, no dos triángulos de teclado: los
                  glifos sueltos son lo que delata una interfaz sin acabar. */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="text-faint shrink-0"
                style={{
                  transform: `rotate(${abierta ? 180 : 0}deg)`,
                  transition: "transform var(--t-ui) var(--ease-out)",
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {abierta && (
              <div className="px-3 pb-3 space-y-2 border-t border-[rgb(var(--nova-fg)/0.08)] pt-2.5">
                {c.messages.map((m, j) => (
                  <div key={j} className={m.role === "user" ? "text-right" : ""}>
                    <span
                      className="inline-block max-w-[85%] px-3 py-1.5 rounded-xl text-sm text-left"
                      style={{
                        background:
                          m.role === "user"
                            ? "rgb(var(--nova-primary) / 0.18)"
                            : "rgb(var(--nova-fg) / 0.06)",
                      }}
                    >
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
      <button
        onClick={async () => {
          if (!window.confirm("¿Borrar todo el historial de conversaciones?")) return;
          await fetch("/api/conversations", { method: "DELETE" });
          await load();
        }}
        className="w-full py-2 rounded-xl text-xs text-dim hover:text-fg glass"
      >
        Borrar historial
      </button>
    </div>
  );
}

function Receipts() {
  const receipts = useNova((s) => s.receipts);
  if (receipts.length === 0) return <p className="text-sm text-faint">Aún no hay acciones.</p>;
  return (
    <div className="space-y-2">
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
        </motion.div>
      ))}
    </div>
  );
}

export function HistoryView() {
  const [tab, setTab] = useState<"conversaciones" | "acciones">("conversaciones");

  const boton = (id: typeof tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className="px-3 py-1.5 rounded-lg text-sm transition-colors"
      style={
        tab === id
          ? { background: "rgb(var(--nova-primary) / 0.22)" }
          : { color: "rgb(var(--nova-fg) / 0.55)" }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 mb-3">
        {boton("conversaciones", "Conversaciones")}
        {boton("acciones", "Actividad")}
      </div>
      <div className="flex-1 overflow-y-auto nova-scroll pr-1">
        {tab === "conversaciones" ? <Conversations /> : <Receipts />}
      </div>
    </div>
  );
}
