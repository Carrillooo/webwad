"use client";
import { FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";

/** Instagram de la marca — SOLO se enseña en esta pantalla de entrada.
 *  Se puede cambiar sin tocar código con NEXT_PUBLIC_INSTAGRAM_URL en Vercel. */
const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/asistentezerodc";
const INSTAGRAM_HANDLE = `@${(INSTAGRAM_URL.split("/").filter(Boolean).pop() ?? "instagram").replace(/^@/, "")}`;

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
      <p className="mt-2 text-[11px]" style={{ color: "rgb(180 83 9)" }}>
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
  const [terms, setTerms] = useState(false);
  /** "code" = te hemos mandado el código de 6 dígitos al email. */
  const [step, setStep] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
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

  const submit = async (e?: FormEvent, withCode?: string) => {
    e?.preventDefault();
    if (busy) return;
    if (mode === "register" && !terms) {
      setError("Marca la casilla de los Términos para crear la cuenta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "register"
          ? { email, password, name, acceptTerms: terms, ...(withCode ? { code: withCode } : {}) }
          : { email, password };
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar. Inténtalo de nuevo.");
        return;
      }
      if (data.pending) {
        // Código enviado: pedirlo antes de crear nada.
        setStep("code");
        setCode("");
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
        setStep("form");
        setError(null);
      }}
      className="flex-1 py-2 text-sm rounded-lg transition-colors"
      style={m === mode ? { background: "rgb(var(--nova-accent) / 0.22)" } : { color: "rgb(var(--nova-fg) / 0.5)" }}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-full w-full grid place-items-center px-5 py-8">
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

        {step === "code" ? (
          <div className="glass holo-border p-4 space-y-3">
            <h2 className="text-sm font-medium">Confirma tu email</h2>
            <p className="text-[12.5px] text-dim leading-snug">
              Te hemos enviado un código de 6 dígitos a <span className="text-fg">{email}</span>.
              Escríbelo aquí (caduca en 10 minutos):
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(undefined, code);
              }}
              className="space-y-2.5"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="······"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full glass px-3 py-2.5 text-center text-xl tracking-[0.5em] bg-transparent outline-none"
                autoFocus
              />
              {error && (
                <p className="text-[12px] leading-snug px-1" style={{ color: "rgb(220 38 38)" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background: "rgb(var(--nova-primary) / 0.85)" }}
              >
                {busy ? "Un momento…" : "Crear mi cuenta"}
              </button>
            </form>
            <div className="flex justify-between text-[12px]">
              <button type="button" onClick={() => { setStep("form"); setError(null); }} className="text-faint hover:text-fg">
                ← Corregir datos
              </button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="disabled:opacity-50" style={{ color: "rgb(var(--nova-accent))" }}>
                Reenviar código
              </button>
            </div>
          </div>
        ) : (
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

            {mode === "register" && (
              <label className="flex items-start gap-2.5 px-1 py-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[rgb(var(--nova-primary))]"
                  required
                />
                <span className="text-[12px] text-dim leading-snug">
                  He leído y acepto los{" "}
                  <a href="/legal/terminos" target="_blank" className="underline underline-offset-2 text-fg">Términos del servicio</a>{" "}
                  y la{" "}
                  <a href="/legal/privacidad" target="_blank" className="underline underline-offset-2 text-fg">Política de privacidad</a>.
                </span>
              </label>
            )}

            {error && (
              <p className="text-[12px] leading-snug px-1" style={{ color: "rgb(220 38 38)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || (mode === "register" && !terms)}
              className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "rgb(var(--nova-primary) / 0.85)" }}
            >
              {busy ? "Un momento…" : mode === "register" ? "Empezar mis 14 días gratis" : "Entrar"}
            </button>
          </form>
        </div>
        )}

        <PlanCard />

        <p className="text-center text-[11px] text-faint leading-snug">
          Al crear la cuenta o continuar con Google/Microsoft aceptas los{" "}
          <a href="/legal/terminos" className="underline underline-offset-2">Términos</a> y la{" "}
          <a href="/legal/privacidad" className="underline underline-offset-2">Política de privacidad</a>.
        </p>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="mx-auto flex items-center justify-center gap-2 w-fit glass px-4 py-2 rounded-full text-[12px] text-dim hover:text-fg transition-colors"
        >
          <InstagramIcon />
          Síguenos en Instagram · {INSTAGRAM_HANDLE}
        </a>
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
    <main className="min-h-full w-full grid place-items-center px-5 py-8">
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
