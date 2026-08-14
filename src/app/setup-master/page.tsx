"use client";
import { useState } from "react";
import Link from "next/link";

/**
 * TEMPORAL — un botón para que la cuenta fundadora se nombre máster, sin
 * claves: la API solo acepta la sesión del email fundador (fijado en el
 * servidor). Quitar esta página cuando Adrián confirme.
 */
export default function SetupMaster() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/claim", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setResult(
        r.ok
          ? { ok: true, text: d.detail ?? "Hecho." }
          : { ok: false, text: d.error ?? `Error ${r.status}.` },
      );
    } catch {
      setResult({ ok: false, text: "Sin conexión con el servidor. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] grid place-items-center px-5 py-8">
      <div className="w-full max-w-sm space-y-4">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-[0.3em] glow-text">ZERO</h1>
          <p className="text-dim text-sm">Activar la cuenta máster</p>
        </header>

        <div className="glass holo-border rounded-2xl p-4 space-y-3">
          <p className="text-[12.5px] text-dim leading-snug">
            Pulsa el botón <strong>con tu sesión de Google ya iniciada</strong> en ZERO. Solo
            funciona para la cuenta fundadora; para cualquier otra persona este botón no hace nada.
          </p>
          <button
            onClick={() => void claim()}
            disabled={busy}
            className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: "rgb(var(--nova-primary) / 0.85)" }}
          >
            {busy ? "Un momento…" : "Hacer máster mi cuenta"}
          </button>
          {result && (
            <p
              className="text-[12px] leading-snug"
              style={{ color: result.ok ? "rgb(52 211 153)" : "rgb(248 113 113)" }}
            >
              {result.text}
            </p>
          )}
        </div>

        <p className="text-center">
          <Link href="/" className="text-[12px]" style={{ color: "rgb(var(--nova-accent))" }}>
            ← Volver a ZERO
          </Link>
        </p>
      </div>
    </main>
  );
}
