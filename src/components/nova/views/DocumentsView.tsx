"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { useDocumentsData } from "@/hooks/useNovaData";

export function DocumentsView() {
  const [query, setQuery] = useState("");
  const { files, loading } = useDocumentsData(query);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium">Documentos</h2>
        <span className="text-xs text-faint">{files.length}</span>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar en Drive…"
        className="glass holo-border px-3 py-2 mb-3 text-sm bg-transparent outline-none placeholder:text-faint"
      />
      <div className="flex-1 overflow-y-auto nova-scroll space-y-2 pr-1">
        {files.map((f, i) => (
          <motion.a
            key={f.id}
            href={f.webViewLink ?? "#"}
            target={f.webViewLink && f.webViewLink !== "#" ? "_blank" : undefined}
            rel="noreferrer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="block glass holo-border px-3 py-2.5 hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--nova-accent))" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <div className="min-w-0">
                <div className="text-sm truncate">{f.name}</div>
                {f.modifiedTime && (
                  <div className="text-[10px] text-faint">{new Date(f.modifiedTime).toLocaleDateString("es-ES")}</div>
                )}
              </div>
            </div>
          </motion.a>
        ))}
        {!loading && files.length === 0 && <p className="text-sm text-faint">Sin resultados.</p>}
      </div>
    </div>
  );
}
