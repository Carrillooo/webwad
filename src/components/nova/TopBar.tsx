"use client";
import { useEffect, useState } from "react";
import { useNova } from "@/lib/store";
import { greeting, humanDay, humanTime } from "@/lib/datetime";
import { OWNER_NAME } from "@/lib/constants";

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  const demoMode = useNova((s) => s.demoMode);
  const setSettingsOpen = useNova((s) => s.setSettingsOpen);
  const novaState = useNova((s) => s.novaState);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-start justify-between px-5 pt-4 gap-3">
      <div>
        <h1 className="text-lg sm:text-xl font-medium glow-text">
          {now ? `${greeting(now)}, ${OWNER_NAME}.` : " "}
        </h1>
        <p className="text-dim text-xs sm:text-sm mt-0.5 tabular-nums">
          {now ? (
            <>
              <span className="capitalize">{humanDay(now)}</span>
              <span className="mx-1.5 text-faint">·</span>
              <span>{humanTime(now)}</span>
            </>
          ) : (
            " "
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {demoMode && (
          <span
            className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full"
            style={{ background: "rgba(251,191,36,0.14)", color: "rgb(251 191 36)", border: "1px solid rgba(251,191,36,0.35)" }}
            title="Datos simulados: no se modifica ninguna cuenta real"
          >
            DEMO
          </span>
        )}
        <span
          className="flex items-center gap-1.5 text-[11px] text-dim glass px-2.5 py-1"
          title={`Estado de ZERO: ${novaState}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: novaState === "error" ? "rgb(248 113 113)" : "rgb(var(--nova-accent))",
              boxShadow: "0 0 6px currentColor",
            }}
          />
          Sincronizado
        </span>
        <button
          type="button"
          aria-label="Configuración"
          onClick={() => setSettingsOpen(true)}
          className="glass holo-border w-9 h-9 grid place-items-center text-dim hover:text-fg transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
