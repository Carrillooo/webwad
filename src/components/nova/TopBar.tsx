"use client";
import { useEffect, useState } from "react";
import { useNova } from "@/lib/store";
import { greeting, humanDay, humanTime } from "@/lib/datetime";

/** Píldora de estado. Pulsable solo cuando hay algo que explicar (demo). */
function Punto({
  alerta,
  demoMode,
  estado,
  onClick,
}: {
  alerta: boolean;
  demoMode: boolean;
  estado: string;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: alerta
            ? "rgb(var(--danger))"
            : demoMode
              ? "rgb(var(--warning))"
              : "rgb(var(--success))",
          boxShadow: "0 0 6px currentColor",
          transition: "background-color var(--t-fast) ease",
        }}
      />
      {estado}
      {/* Una flecha basta para decir que se puede pulsar; poner "· conectar"
          detrás de "Sin conectar" repetía la palabra. */}
      {demoMode && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-faint shrink-0" aria-hidden>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </>
  );
  const clase = "flex items-center gap-1.5 text-[0.7rem] text-dim glass px-2.5 py-1 rounded-full whitespace-nowrap";

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={clase}
      title="Todavía no hay ninguna cuenta enlazada: nada sale de aquí. Pulsa para conectarla."
    >
      {contenido}
    </button>
  ) : (
    <span className={clase} aria-live="polite" title={`Estado de ZERO: ${estado}`}>
      {contenido}
    </span>
  );
}

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  const userName = useNova((s) => s.userName);
  const demoMode = useNova((s) => s.demoMode);
  const setSettingsOpen = useNova((s) => s.setSettingsOpen);
  const panelOpen = useNova((s) => s.panelOpen);
  const setPanelOpen = useNova((s) => s.setPanelOpen);
  const novaState = useNova((s) => s.novaState);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // En móvil el nombre completo rompía el saludo en una columna de palabras:
  // con el nombre de pila basta y cabe siempre.
  const firstName = userName?.trim().split(/\s+/)[0] ?? null;

  // El estado real de ZERO, no una etiqueta decorativa. Antes ponía
  // "Sincronizado" siempre — incluso en demo, donde no hay nada que
  // sincronizar. La regla número uno del proyecto es no fingir.
  const ESTADO: Record<string, string> = {
    idle: "Listo",
    listening: "Escuchando",
    transcribing: "Escuchando",
    thinking: "Pensando",
    planning: "Pensando",
    executing: "Trabajando",
    speaking: "Hablando",
    success: "Hecho",
    warning: "Atención",
    error: "Error",
  };
  // "DEMO" delante de un cliente resta, y además no dice nada útil. "Sin
  // conectar" es exactamente lo que pasa (no hay cuenta enlazada, nada sale
  // de aquí) y le dice al usuario qué le falta por hacer.
  const estado = demoMode ? "Sin conectar" : (ESTADO[novaState] ?? "Listo");
  const alerta = novaState === "error" || novaState === "warning";

  return (
    <header className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between px-5 pt-4 gap-2 sm:gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.4rem] font-semibold truncate">
          {now ? `${greeting(now)}${firstName ? `, ${firstName}` : ""}.` : " "}
        </h1>
        <p className="text-dim text-xs sm:text-sm mt-1 tnum">
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

      <div className="flex items-center gap-2 justify-end">
        {/* Una sola píldora de estado. Antes había DOS avisos diciendo lo
            mismo — "DEMO · por qué" y "Modo demo" — y entre los dos se comían
            la fila entera del móvil. En demo la píldora es pulsable y lleva a
            Ajustes, que es donde se explica qué falta. */}
        <Punto
          alerta={alerta}
          demoMode={demoMode}
          estado={estado}
          onClick={demoMode ? () => setSettingsOpen(true) : undefined}
        />
        <button
          type="button"
          aria-label={panelOpen ? "Cerrar monitor" : "Abrir monitor"}
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
          className="glass holo-border w-9 h-9 grid place-items-center text-dim hover:text-fg"
          data-active={panelOpen}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Configuración"
          onClick={() => setSettingsOpen(true)}
          className="glass holo-border w-9 h-9 grid place-items-center text-dim hover:text-fg"
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
