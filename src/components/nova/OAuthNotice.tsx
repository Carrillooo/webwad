"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNova } from "@/lib/store";

/**
 * Al volver de conectar Google u Outlook, el callback añade ?google=... o
 * ?microsoft=... a la URL. Antes nadie lo leía: si fallaba, el usuario volvía
 * a la web y simplemente seguía apareciendo "Sin conectar", sin explicación.
 */
const MENSAJES: Record<string, { texto: string; ok: boolean }> = {
  connected: { texto: "conectado correctamente.", ok: true },
  sin_cifrado: {
    texto:
      "inició sesión bien, pero falta TOKEN_ENCRYPTION_KEY en Vercel: sin ella el token no se puede guardar. Añádela, redespliega y vuelve a conectar.",
    ok: false,
  },
  error: {
    texto: "no se pudo guardar la conexión. Mira el motivo exacto en Ajustes → Estado.",
    ok: false,
  },
  invalid: { texto: "la respuesta llegó incompleta. Vuelve a intentarlo.", ok: false },
  badstate: { texto: "el enlace de conexión caducó. Vuelve a pulsar Conectar.", ok: false },
};

export function OAuthNotice() {
  const [aviso, setAviso] = useState<{ quien: string; texto: string; ok: boolean } | null>(null);
  const setSettingsOpen = useNova((s) => s.setSettingsOpen);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const quien = p.has("google") ? "Google" : p.has("microsoft") ? "Outlook" : null;
    if (!quien) return;
    const clave = p.get(quien === "Google" ? "google" : "microsoft") ?? "";
    const m = MENSAJES[clave];
    if (m) setAviso({ quien, ...m });
    // Deja la URL limpia para que no se repita al recargar.
    p.delete("google");
    p.delete("microsoft");
    const query = p.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
  }, []);

  useEffect(() => {
    if (!aviso?.ok) return; // los errores se quedan hasta que se cierran
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          className="fixed left-3 right-3 z-40 max-w-md mx-auto glass holo-border px-3.5 py-3 text-sm"
          style={{ top: 74, borderColor: aviso.ok ? undefined : "rgba(251,191,36,0.45)" }}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
        >
          <div className="flex items-start gap-2">
            <span aria-hidden>{aviso.ok ? "✅" : "⚠️"}</span>
            <p className="flex-1 leading-snug">
              <span className="text-fg">{aviso.quien}</span>{" "}
              <span className="text-dim">{aviso.texto}</span>
            </p>
            <button
              onClick={() => setAviso(null)}
              className="text-faint hover:text-fg px-1"
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
          {!aviso.ok && (
            <button
              onClick={() => {
                setAviso(null);
                setSettingsOpen(true);
              }}
              className="mt-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgb(var(--nova-accent) / 0.22)" }}
            >
              Ver qué falta
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
