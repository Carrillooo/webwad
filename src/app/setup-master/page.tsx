"use client";
import { useState } from "react";
import Link from "next/link";

/**
 * Nombrar la cuenta máster desde el navegador (móvil incluido), sin Terminal.
 * La página es pública pero inofensiva: la operación real la valida la API
 * con el CRON_SECRET del servidor — sin el secreto no hace nada.
 */
export default function SetupMaster() {
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret.trim()}`,
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      setResult(
        r.ok
          ? { ok: true, text: `${d.detail ?? "Hecho."} Cierra sesión y vuelve a entrar para ver la insignia.` }
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
          <p className="text-dim text-sm">Nombrar la cuenta máster</p>
        </header>

        <div className="glass holo-border rounded-2xl p-4 space-y-2.5">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email de la cuenta (ya registrada)"
            type="email"
            autoComplete="email"
            className="w-full glass px-3 py-2.5 text-sm bg-transparent outline-none rounded-xl"
          />
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="CRON_SECRET (el de Vercel)"
            type="password"
            className="w-full glass px-3 py-2.5 text-sm bg-transparent outline-none rounded-xl"
          />
          <button
            onClick={() => void submit()}
            disabled={busy || !email.trim() || !secret.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: "rgb(var(--nova-primary) / 0.85)" }}
          >
            {busy ? "Un momento…" : "Hacer máster"}
          </button>
          {result && (
            <p
              className="text-[12px] leading-snug"
              style={{ color: result.ok ? "rgb(52 211 153)" : "rgb(248 113 113)" }}
            >
              {result.text}
            </p>
          )}
          <p className="text-[11px] text-faint leading-snug">
            La cuenta queda activa para siempre y con acceso al panel /admin; si otra cuenta era
            máster, deja de serlo. El secreto no se guarda en el navegador.
          </p>
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
