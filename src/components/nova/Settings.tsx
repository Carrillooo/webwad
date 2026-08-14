"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNova, defaultSettings, type Settings as S } from "@/lib/store";
import { usePush } from "@/hooks/usePush";

function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.split(" ").map(Number);
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Fila estilo Ajustes de iOS: etiqueta (y pista opcional) a la izquierda,
 *  control a la derecha. Va dentro de un <Group> que pinta los separadores. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 min-h-[48px]">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-faint leading-snug mt-0.5">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Grupo redondeado con separadores finos, como las tarjetas de Ajustes de iOS. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass holo-border rounded-2xl overflow-hidden divide-y divide-[rgb(var(--nova-fg)/0.08)]">
      {children}
    </div>
  );
}

/** Interruptor estilo Apple: verde al activar, con el tirador animado. */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-[50px] h-[30px] rounded-full shrink-0 transition-colors duration-200"
      style={{ background: checked ? "rgb(52 199 89)" : "rgb(var(--nova-fg) / 0.22)" }}
    >
      <motion.span
        className="absolute top-[2px] left-[2px] w-[26px] h-[26px] rounded-full bg-white"
        style={{ boxShadow: "0 2px 5px rgb(0 0 0 / 0.35)" }}
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 550, damping: 34 }}
      />
    </button>
  );
}

function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={rgbToHex(value)}
      onChange={(e) => onChange(hexToRgb(e.target.value))}
      className="w-10 h-7 rounded bg-transparent cursor-pointer"
    />
  );
}

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-32 accent-[rgb(var(--nova-primary))]" />
  );
}

function GoogleConnection() {
  const [state, setState] = useState<{
    configured: boolean;
    connection: { connected: boolean; email?: string };
  } | null>(null);

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ configured: false, connection: { connected: false } }));
  }, []);

  if (!state) return <p className="text-xs text-faint py-2">Comprobando…</p>;

  if (!state.configured) {
    return (
      <div className="glass px-3 py-2.5 text-xs text-dim">
        Google no está configurado. Añade credenciales (ver <span className="text-fg">/setup</span>) para conectar Calendar, Tasks y Docs reales.
      </div>
    );
  }

  const connected = state.connection.connected;
  return (
    <div className="glass holo-border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">Google</div>
        <div className="text-[11px] text-faint truncate">
          {connected ? state.connection.email ?? "Conectado" : "Sin conectar"}
        </div>
      </div>
      {connected ? (
        <button
          onClick={async () => {
            await fetch("/api/google/disconnect", { method: "POST" });
            setState({ ...state, connection: { connected: false } });
          }}
          className="px-3 py-1.5 rounded-lg text-xs text-[rgb(248,113,113)]"
          style={{ background: "rgba(248,113,113,0.14)" }}
        >
          Desconectar
        </button>
      ) : (
        <a
          href="/api/google/authorize"
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "rgb(var(--nova-accent) / 0.22)" }}
        >
          Conectar
        </a>
      )}
    </div>
  );
}

/** Enlace iCal para suscribir la agenda de ZERO desde Apple, Google u Outlook. */
function CalendarFeed() {
  const [feed, setFeed] = useState<{ configured: boolean; url?: string; webcal?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/feed-url")
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setFeed({ configured: false }));
  }, []);

  if (!feed) return <p className="text-xs text-faint py-2">Comprobando…</p>;

  if (!feed.configured || !feed.url) {
    return (
      <div className="glass px-3 py-2.5 text-xs text-dim">
        Falta <span className="text-fg">CALENDAR_FEED_SECRET</span> (o{" "}
        <span className="text-fg">TOKEN_ENCRYPTION_KEY</span>) para firmar el enlace de suscripción.
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feed.url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin portapapeles: el enlace se puede seleccionar a mano */
    }
  };

  return (
    <div className="glass holo-border px-3 py-2.5 space-y-2">
      <p className="text-[11px] text-faint leading-snug">
        Suscríbete desde iPhone, Mac, Google Calendar u Outlook y verás aquí todo lo que ZERO
        apunte. Es de solo lectura: quien tenga el enlace ve la agenda, pero no puede tocarla.
      </p>
      <div className="text-[10px] text-dim break-all font-mono leading-tight">{feed.url}</div>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "rgb(var(--nova-accent) / 0.22)" }}
        >
          {copied ? "Copiado ✓" : "Copiar enlace"}
        </button>
        {feed.webcal && (
          <a href={feed.webcal} className="px-3 py-1.5 rounded-lg text-xs glass holo-border">
            Añadir a Apple
          </a>
        )}
      </div>
    </div>
  );
}

/** Qué falta para que ZERO deje de ir en demo. Sin adivinar: lo dice /api/health. */
/** Cuenta y suscripción: quién soy, qué plan tengo y cerrar sesión. */
function AccountSection() {
  const [me, setMe] = useState<{
    authRequired: boolean;
    account: {
      email: string;
      name: string;
      isOwner: boolean;
      subscription: { status: string; daysLeft: number | null };
      plan: { name: string; priceEur: number };
    } | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (!me?.account) return null; // en demo local no hay cuenta (y no se pinta ni la cabecera)

  const { account } = me;
  const sub = account.subscription;
  const estado =
    account.isOwner || sub.status === "active"
      ? "Suscripción activa"
      : sub.status === "trial"
        ? `Prueba gratuita · ${sub.daysLeft} día${sub.daysLeft === 1 ? "" : "s"} restantes`
        : "Prueba terminada";

  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Cuenta</h3>
      <div className="glass holo-border rounded-2xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm truncate">{account.name}</div>
          <div className="text-[11px] text-faint truncate">{account.email}</div>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.reload();
          }}
          className="px-3 py-1.5 rounded-lg text-xs shrink-0 text-[rgb(248,113,113)]"
          style={{ background: "rgba(248,113,113,0.14)" }}
        >
          Cerrar sesión
        </button>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-dim">
          {account.plan.name} · {account.plan.priceEur} €/mes
        </span>
        <span style={{ color: sub.status === "expired" ? "rgb(248 113 113)" : "rgb(52 211 153)" }}>
          {estado}
        </span>
      </div>
      {sub.status === "trial" && (
        <p className="text-[11px] text-faint leading-snug">
          La pasarela de pago está al llegar; podrás suscribirte desde aquí sin perder nada.
        </p>
      )}
      </div>
    </section>
  );
}

/** Probador de micrófono: pide permiso de verdad y dice qué falla y dónde
 *  arreglarlo. Pensado para "no me pide permisos y no va". */
function MicCheck() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const probar = async () => {
    setBusy(true);
    setResult(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setResult({ ok: false, text: "Este navegador no permite el micrófono aquí. Usa Chrome, Edge o Safari actualizados, siempre por https." });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const stt =
        typeof window !== "undefined" &&
        Boolean(
          (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
            .SpeechRecognition ??
            (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
        );
      setResult({
        ok: true,
        text: stt
          ? "Micrófono y reconocimiento de voz funcionando ✓"
          : "Micrófono OK, pero este navegador no reconoce voz: habla ZERO pero tendrás que escribirle (usa Chrome/Edge/Safari para dictar).",
      });
    } catch (e) {
      const name = (e as Error).name;
      setResult({
        ok: false,
        text:
          name === "NotAllowedError" || name === "SecurityError"
            ? "El micrófono está BLOQUEADO para esta web. Pulsa el candado 🔒 junto a la dirección → Micrófono → Permitir y recarga. Si no aparece la opción, es el ordenador: en Mac, Ajustes del Sistema → Privacidad y seguridad → Micrófono → activa el navegador; en Windows, Configuración → Privacidad → Micrófono."
            : name === "NotFoundError"
              ? "No hay ningún micrófono conectado o activo en este equipo."
              : `El micrófono falló (${name}). Cierra otras apps que lo usen y prueba de nuevo.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass holo-border px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm">Micrófono</div>
          <div className="text-[11px] text-faint">Comprueba permiso y reconocimiento de voz.</div>
        </div>
        <button
          onClick={() => void probar()}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs shrink-0 disabled:opacity-40"
          style={{ background: "rgb(var(--nova-accent) / 0.22)" }}
        >
          {busy ? "Probando…" : "Probar"}
        </button>
      </div>
      {result && (
        <p
          className="text-[11px] leading-snug"
          style={{ color: result.ok ? "rgb(52 211 153)" : "rgb(251 191 36)" }}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

/** Qué hacer ante cada motivo, en cristiano. */
const MOTIVO: Record<string, string> = {
  sin_credenciales: "Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.",
  demo_mode:
    "Tienes DEMO_MODE=true en Vercel. Ponla a false (o bórrala) y redespliega: eso obliga a los datos simulados aunque todo lo demás esté bien.",
  sin_cifrado:
    "Falta TOKEN_ENCRYPTION_KEY en Vercel. Es la que descifra el token de Google guardado; sin ella no se puede usar aunque figure conectado.",
  sin_conexion: "Pulsa Conectar en Google, aquí abajo.",
  token_rechazado:
    "Google ha rechazado el acceso: el permiso se revocó o caducó (pasa a los 7 días si la pantalla de consentimiento sigue en «Testing»). Desconecta y vuelve a conectar.",
};

function Diagnostico() {
  const demoMode = useNova((s) => s.demoMode);
  const [h, setH] = useState<Record<string, boolean> | null>(null);
  const [google, setGoogle] = useState<{ usable: boolean; reason: string } | null>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setH).catch(() => setH({}));
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setGoogle({ usable: Boolean(d?.usable), reason: String(d?.reason ?? "") }))
      .catch(() => setGoogle({ usable: false, reason: "" }));
  }, []);

  if (!h) return null;

  const faltan: string[] = [];
  if (!h.anthropic) faltan.push("ANTHROPIC_API_KEY — la IA de verdad");
  if (!h.database) faltan.push("DATABASE_URL — la base de datos de Vercel");
  // Google: en vez de "conéctalo" (que puede estar ya conectado y aun así no
  // servir), decimos el motivo concreto que devuelve el servidor.
  if (google && !google.usable && MOTIVO[google.reason]) faltan.push(MOTIVO[google.reason]);

  if (!demoMode && faltan.length === 0) {
    return (
      <div className="glass holo-border px-3 py-2.5 text-xs">
        <span className="text-fg">Todo conectado.</span>{" "}
        <span className="text-faint">ZERO trabaja con tus cuentas de verdad.</span>
      </div>
    );
  }

  return (
    <div
      className="glass px-3 py-2.5 text-xs space-y-1.5"
      style={{ border: "1px solid rgba(251,191,36,0.35)" }}
    >
      <div style={{ color: "rgb(251 191 36)" }} className="font-semibold">
        {demoMode ? "Modo demo: nada llega a tus cuentas" : "Falta algo por conectar"}
      </div>
      {faltan.length > 0 ? (
        <>
          <ul className="text-dim space-y-1">
            {faltan.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          {!h.database && google !== null && (
            <p className="text-faint leading-snug pt-1">
              Aunque Google salga conectado abajo, sin base de datos esa conexión se guarda en
              la memoria de un solo servidor y Vercel usa varios: unas veces la encuentra y
              otras no. Créala en Vercel → Storage y redespliega.
            </p>
          )}
        </>
      ) : (
        <p className="text-dim">
          Todo parece en su sitio pero las peticiones siguen cayendo en datos simulados. Recarga
          la página; si sigue igual, mira la terminal de Vercel (Deployments → Functions) para ver
          el error exacto.
        </p>
      )}
    </div>
  );
}

function DatabaseStatus() {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setReady(Boolean(data.database)))
      .catch(() => setReady(false));
  }, []);

  return (
    <div className="glass holo-border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">Base de datos Vercel</div>
        <div className="text-[11px] text-faint">
          {ready === null ? "Comprobando…" : ready ? "PostgreSQL conectado · persistencia activa" : "Sin conexión · revisa DATABASE_URL en Vercel"}
        </div>
      </div>
      <span
        className="text-[10px] font-semibold px-2 py-1 rounded-full"
        style={{
          color: ready ? "rgb(52 211 153)" : ready === false ? "rgb(251 191 36)" : "var(--fg-faint)",
          background: ready ? "rgba(52,211,153,0.12)" : ready === false ? "rgba(251,191,36,0.12)" : "rgb(var(--panel) / 0.05)",
        }}
      >
        {ready === null ? "…" : ready ? "READY" : "MISSING"}
      </span>
    </div>
  );
}

function OutlookConnection() {
  const [state, setState] = useState<{ configured: boolean; connection: { connected: boolean; email?: string } } | null>(null);

  useEffect(() => {
    fetch("/api/microsoft/status")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ configured: false, connection: { connected: false } }));
  }, []);

  if (!state) return <p className="text-xs text-faint py-2">Comprobando Outlook…</p>;

  if (!state.configured) {
    return (
      <div className="glass px-3 py-2.5 text-xs text-dim">
        Outlook sin configurar: añade <span className="text-fg">MICROSOFT_CLIENT_ID</span> y{" "}
        <span className="text-fg">MICROSOFT_CLIENT_SECRET</span> en Vercel (ver /setup).
      </div>
    );
  }

  const connected = state.connection.connected;
  return (
    <div className="glass holo-border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">Outlook (Microsoft To Do)</div>
        <div className="text-[11px] text-faint truncate">
          {connected ? state.connection.email ?? "Conectado" : "Sin conectar"}
        </div>
      </div>
      {connected ? (
        <button
          onClick={async () => {
            await fetch("/api/microsoft/disconnect", { method: "POST" });
            setState({ ...state, connection: { connected: false } });
          }}
          className="px-3 py-1.5 rounded-lg text-xs text-[rgb(248,113,113)]"
          style={{ background: "rgba(248,113,113,0.14)" }}
        >
          Desconectar
        </button>
      ) : (
        <a
          href="/api/microsoft/authorize"
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "rgb(var(--nova-accent) / 0.22)" }}
        >
          Conectar
        </a>
      )}
    </div>
  );
}

function NotificationsSetting() {
  const { state, enable, test } = usePush();
  const label: Record<string, string> = {
    unsupported: "Tu navegador no admite notificaciones push.",
    unconfigured: "Sin configurar (faltan claves VAPID en el servidor).",
    default: "Activa avisos de eventos y tareas.",
    denied: "Permiso denegado en el navegador.",
    granted: "Permitido — activa la suscripción.",
    subscribed: "Activadas ✓",
  };
  const canEnable = state === "default" || state === "granted";
  const subscribed = state === "subscribed";
  return (
    <Group>
      <Row label="Avisos en el móvil" hint={label[state]}>
        {subscribed ? (
          <Toggle checked onChange={() => {}} />
        ) : (
          <span className={canEnable ? "" : "opacity-40 pointer-events-none"}>
            <Toggle checked={false} onChange={() => void enable()} />
          </span>
        )}
      </Row>
      {subscribed && (
        <Row label="Enviar un aviso de prueba">
          <button onClick={() => void test()} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgb(var(--nova-accent) / 0.22)" }}>
            Probar
          </button>
        </Row>
      )}
    </Group>
  );
}

export function Settings() {
  const open = useNova((s) => s.settingsOpen);
  const setOpen = useNova((s) => s.setSettingsOpen);
  const settings = useNova((s) => s.settings);
  const update = useNova((s) => s.updateSettings);

  const set = <K extends keyof S>(k: K, v: S[K]) => update({ [k]: v } as Partial<S>);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          {/* Modal centrado (≈ media pantalla en escritorio), estilo hoja de iOS. */}
          <div className="fixed inset-0 z-50 grid place-items-center p-3 pointer-events-none">
            <motion.section
              role="dialog"
              aria-label="Ajustes"
              className="pointer-events-auto w-[min(94vw,560px)] max-h-[88dvh] flex flex-col glass holo-border rounded-3xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
            >
              <header className="flex items-center justify-between px-5 py-3.5 border-b border-[rgb(var(--nova-fg)/0.08)] shrink-0">
                <span className="w-12" aria-hidden />
                <h2 className="text-base font-semibold glow-text">Ajustes</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="w-12 text-right text-sm font-medium"
                  style={{ color: "rgb(var(--nova-accent))" }}
                >
                  Listo
                </button>
              </header>

              <div className="overflow-y-auto nova-scroll px-4 py-4 space-y-5">
                <AccountSection />

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Cuentas enlazadas</h3>
                  <div className="space-y-2">
                    <GoogleConnection />
                    <OutlookConnection />
                  </div>
                  <p className="text-[11px] text-faint leading-snug mt-1.5 px-4">
                    Al enlazar, ZERO usa tu calendario, tus tareas y tu correo de verdad.
                  </p>
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Avisos</h3>
                  <NotificationsSetting />
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Voz</h3>
                  <Group>
                    <Row label="Hablar con ZERO" hint="El micrófono y las respuestas por voz">
                      <Toggle checked={settings.voiceEnabled} onChange={(v) => set("voiceEnabled", v)} />
                    </Row>
                    <Row label="Activar con 2 palmadas 👏">
                      <Toggle checked={settings.clapEnabled} onChange={(v) => set("clapEnabled", v)} />
                    </Row>
                    <Row label="Conversación seguida 🎙️" hint="Si ZERO te pregunta, el micro se abre solo">
                      <Toggle checked={settings.autoListen} onChange={(v) => set("autoListen", v)} />
                    </Row>
                    <Row label="Sonidos" hint="El bip al empezar a escuchar">
                      <Toggle checked={settings.sounds} onChange={(v) => set("sounds", v)} />
                    </Row>
                    {/* La voz de ZERO es fija (la pone el servidor): sin selector. */}
                    <Row label="Velocidad"><Slider value={settings.voiceRate} min={0.5} max={2} step={0.1} onChange={(v) => set("voiceRate", v)} /></Row>
                    <Row label="Volumen"><Slider value={settings.voiceVolume} min={0} max={1} step={0.05} onChange={(v) => set("voiceVolume", v)} /></Row>
                  </Group>
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Apariencia</h3>
                  <Group>
                    <Row label="Tema">
                      <select value={settings.theme} onChange={(e) => set("theme", e.target.value as S["theme"])} className="glass px-2 py-1.5 text-sm bg-transparent rounded-lg">
                        <option value="dark">Oscuro</option>
                        <option value="light">Claro</option>
                        <option value="system">Sistema</option>
                      </select>
                    </Row>
                    <Row label="Color principal"><Color value={settings.primary} onChange={(v) => set("primary", v)} /></Row>
                    <Row label="Color de acento"><Color value={settings.accent} onChange={(v) => set("accent", v)} /></Row>
                    <Row label="Color del núcleo"><Color value={settings.core} onChange={(v) => set("core", v)} /></Row>
                    <Row label="Bordes holográficos"><Color value={settings.border} onChange={(v) => set("border", v)} /></Row>
                    <Row label="Brillo (glow)"><Slider value={settings.glow} min={0} max={1} step={0.05} onChange={(v) => set("glow", v)} /></Row>
                    <Row label="Partículas"><Slider value={settings.particles} min={0} max={1} step={0.05} onChange={(v) => set("particles", v)} /></Row>
                    <Row label="Animaciones"><Slider value={settings.motion} min={0} max={1} step={0.05} onChange={(v) => set("motion", v)} /></Row>
                    <Row label="Efectos reducidos" hint="Menos brillos y movimiento; va más fluido">
                      <Toggle checked={settings.reducedEffects} onChange={(v) => set("reducedEffects", v)} />
                    </Row>
                  </Group>
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Suscribir el calendario</h3>
                  <CalendarFeed />
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Regional</h3>
                  <Group>
                    <Row label="Idioma">
                      <select value={settings.language} onChange={(e) => set("language", e.target.value)} className="glass px-2 py-1.5 text-sm bg-transparent rounded-lg">
                        <option value="es-ES">Español (España)</option>
                        <option value="es-MX">Español (México)</option>
                      </select>
                    </Row>
                    <Row label="Zona horaria">
                      <span className="text-sm text-faint">{settings.timezone}</span>
                    </Row>
                  </Group>
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1.5 px-4">Estado del sistema</h3>
                  <div className="space-y-2">
                    <MicCheck />
                    <Diagnostico />
                    <DatabaseStatus />
                  </div>
                </section>

                <button onClick={() => update(defaultSettings)} className="w-full glass holo-border rounded-2xl py-2.5 text-sm text-dim hover:text-fg">
                  Restablecer valores
                </button>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
