"use client";
import { FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";

/** Errores con los que puede volver «Continuar con Google/Microsoft». */
const LOGIN_ERRORES: Record<string, string> = {
  sin_email: "El proveedor no nos dio tu email. Prueba con otra cuenta.",
  email_invalido: "El proveedor devolvió un email que no parece válido.",
  google_no_configurado: "Entrar con Google no está disponible todavía.",
  microsoft_no_configurado: "Entrar con Microsoft no está disponible todavía.",
  error: "No se pudo completar el acceso. Inténtalo de nuevo.",
};

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
          <li>· Calendario y tareas de Outlook (Microsoft)</li>
          <li>· Envía emails desde TU propio correo (Gmail u Outlook)</li>
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
export function AuthScreen({
  onDone,
  oauth,
}: {
  onDone: () => void;
  oauth?: { google: boolean; microsoft: boolean };
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Si venimos de un intento OAuth fallido, la URL trae ?login=<motivo>.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const reason = p.get("login");
    if (reason) {
      setError(LOGIN_ERRORES[reason] ?? LOGIN_ERRORES.error);
      p.delete("login");
      const rest = p.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
  }, []);

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

          {(oauth?.google || oauth?.microsoft) && (
            <div className="space-y-2">
              {oauth.google && (
                <a
                  href="/api/auth/google/start"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm glass"
                  style={{ background: "rgb(var(--nova-fg) / 0.08)" }}
                >
                  <span aria-hidden className="font-semibold">G</span>
                  Continuar con Google
                </a>
              )}
              {oauth.microsoft && (
                <a
                  href="/api/auth/microsoft/start"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm glass"
                  style={{ background: "rgb(var(--nova-fg) / 0.08)" }}
                >
                  <span aria-hidden className="font-semibold">⊞</span>
                  Continuar con Microsoft
                </a>
              )}
              <p className="text-center text-[11px] text-faint">
                Al entrar así, tu calendario, tareas y correo quedan enlazados de una vez.
              </p>
              <div className="flex items-center gap-3 text-[11px] text-faint">
                <span className="h-px flex-1 bg-current opacity-20" />
                o con email
                <span className="h-px flex-1 bg-current opacity-20" />
              </div>
            </div>
          )}

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

        <p className="text-center text-[11px] text-faint leading-snug">
          Al crear la cuenta o continuar con Google/Microsoft aceptas los{" "}
          <a href="/legal/terminos" className="underline underline-offset-2">Términos</a> y la{" "}
          <a href="/legal/privacidad" className="underline underline-offset-2">Política de privacidad</a>.
        </p>
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
