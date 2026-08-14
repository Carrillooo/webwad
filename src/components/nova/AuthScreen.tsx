"use client";
import { FormEvent, useState } from "react";
import { motion } from "motion/react";

/** Tarjeta del único plan. Sin pasarela todavía: el registro regala la prueba. */
export function PlanCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="glass holo-border px-4 py-3 text-left">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">ZERO Pro</span>
        <span className="text-lg font-semibold">
          20 €<span className="text-xs text-faint font-normal">/mes</span>
        </span>
      </div>
      {!compact && (
        <ul className="mt-2 space-y-1 text-[11px] text-dim leading-snug">
          <li>· Asistente con IA por voz, en español</li>
          <li>· Tu Google Calendar, Tasks, Drive y Docs de verdad</li>
          <li>· Tareas de Outlook (Microsoft To Do)</li>
          <li>· Briefing matinal y avisos antes de cada evento</li>
          <li>· Memoria personal: ZERO se acuerda de lo tuyo</li>
        </ul>
      )}
      <p className="mt-2 text-[11px]" style={{ color: "rgb(251 191 36)" }}>
        14 días de prueba gratis · sin tarjeta
      </p>
    </div>
  );
}

/**
 * Puerta de entrada: crear cuenta o iniciar sesión. Cada cuenta enlaza SU
 * Google y SU Outlook: nadie ve nada de nadie.
 */
export function AuthScreen({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email, password, name } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar. Inténtalo de nuevo.");
        return;
      }
      onDone();
    } catch {
      setError("Sin conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: "login" | "register", label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className="flex-1 py-2 text-sm rounded-lg transition-colors"
      style={m === mode ? { background: "rgb(var(--nova-accent) / 0.22)" } : { color: "rgb(var(--nova-fg) / 0.5)" }}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-[100dvh] w-full grid place-items-center px-5 py-8">
      <motion.div
        className="w-full max-w-sm space-y-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <header className="text-center space-y-1">
          <h1 className="text-3xl font-semibold tracking-[0.3em] glow-text">ZERO</h1>
          <p className="text-dim text-sm">Tu asistente personal con IA, por voz y en español.</p>
        </header>

        <div className="glass holo-border p-4 space-y-3">
          <div className="flex gap-2">
            {tab("login", "Entrar")}
            {tab("register", "Crear cuenta")}
          </div>

          <form onSubmit={submit} className="space-y-2.5">
            {mode === "register" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre (así te llamará ZERO)"
                autoComplete="name"
                className="w-full glass px-3 py-2.5 text-sm bg-transparent outline-none"
                required
              />
            )}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
              className="w-full glass px-3 py-2.5 text-sm bg-transparent outline-none"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"}
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="w-full glass px-3 py-2.5 text-sm bg-transparent outline-none"
              required
            />

            {error && (
              <p className="text-[12px] leading-snug px-1" style={{ color: "rgb(248 113 113)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "rgb(var(--nova-primary) / 0.85)" }}
            >
              {busy ? "Un momento…" : mode === "register" ? "Empezar mis 14 días gratis" : "Entrar"}
            </button>
          </form>
        </div>

        <PlanCard />
      </motion.div>
    </main>
  );
}

/** Muro del plan: la prueba terminó y aún no hay pasarela de pago. */
export function PaywallScreen({
  email,
  onLogout,
}: {
  email: string;
  onLogout: () => void;
}) {
  return (
    <main className="min-h-[100dvh] w-full grid place-items-center px-5 py-8">
      <motion.div
        className="w-full max-w-sm space-y-4 text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-[0.3em] glow-text">ZERO</h1>
        <div className="glass holo-border p-4 space-y-3 text-left">
          <p className="text-sm">Tu prueba gratuita ha terminado.</p>
          <p className="text-[12px] text-dim leading-snug">
            Gracias por probar ZERO. La pasarela de pago está al llegar; en cuanto esté activa
            podrás suscribirte desde aquí y seguir justo donde lo dejaste — tus conexiones y tu
            memoria no se borran.
          </p>
          <PlanCard compact />
          <button
            disabled
            className="w-full py-2.5 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed"
            style={{ background: "rgb(var(--nova-primary) / 0.85)" }}
          >
            Suscribirme — muy pronto
          </button>
        </div>
        <button onClick={onLogout} className="text-[12px] text-faint hover:text-fg">
          Cerrar sesión ({email})
        </button>
      </motion.div>
    </main>
  );
}
