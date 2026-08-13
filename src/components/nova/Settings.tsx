"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNova, defaultSettings, type Settings as S } from "@/lib/store";
import { WebSpeechTTS } from "@/lib/providers/speech/browser";
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-dim">{label}</span>
      {children}
    </label>
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
    connection: { connected: boolean; email?: string; preconfigured?: boolean };
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
  // Cuenta fija (GOOGLE_REFRESH_TOKEN): no hay nada que enlazar ni desenlazar.
  const preconfigured = Boolean(state.connection.preconfigured);
  return (
    <div className="glass holo-border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">Google</div>
        <div className="text-[11px] text-faint truncate">
          {connected ? state.connection.email ?? "Conectado" : "Sin conectar"}
        </div>
      </div>
      {preconfigured ? (
        <span
          className="px-3 py-1.5 rounded-lg text-[11px] text-dim shrink-0"
          style={{ background: "rgb(var(--nova-accent) / 0.14)" }}
        >
          Siempre enlazado
        </span>
      ) : connected ? (
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
function Diagnostico() {
  const demoMode = useNova((s) => s.demoMode);
  const [h, setH] = useState<Record<string, boolean> | null>(null);
  const [google, setGoogle] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setH).catch(() => setH({}));
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setGoogle(Boolean(d?.connection?.connected)))
      .catch(() => setGoogle(false));
  }, []);

  if (!h) return null;

  const faltan: string[] = [];
  if (!h.anthropic) faltan.push("ANTHROPIC_API_KEY — la IA de verdad");
  if (!google) faltan.push("Conectar Google — calendario, tareas y Drive reales");
  if (!h.database) faltan.push("DATABASE_URL — para que no se olvide de nada");

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
        <ul className="text-dim space-y-1">
          {faltan.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      ) : (
        <p className="text-dim">
          Google figura conectado pero las peticiones siguen cayendo en datos simulados.
          Suele ser que la conexión se guardó solo en memoria: pon <span className="text-fg">DATABASE_URL</span>{" "}
          o, mejor, <span className="text-fg">GOOGLE_REFRESH_TOKEN</span>.
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
  return (
    <div className="glass holo-border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">Web Push</div>
        <div className="text-[11px] text-faint">{label[state]}</div>
      </div>
      {state === "subscribed" ? (
        <button onClick={() => void test()} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgb(var(--nova-accent) / 0.22)" }}>
          Probar
        </button>
      ) : (
        <button
          onClick={() => void enable()}
          disabled={!canEnable}
          className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
          style={{ background: "rgb(var(--nova-accent) / 0.22)" }}
        >
          Activar
        </button>
      )}
    </div>
  );
}

export function Settings() {
  const open = useNova((s) => s.settingsOpen);
  const setOpen = useNova((s) => s.setSettingsOpen);
  const settings = useNova((s) => s.settings);
  const update = useNova((s) => s.updateSettings);
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);
  const [elevenVoices, setElevenVoices] = useState<{ id: string; name: string; detail: string }[]>([]);

  useEffect(() => {
    fetch("/api/tts/voices")
      .then((r) => r.json())
      .then((d) => setElevenVoices(d.voices ?? []))
      .catch(() => setElevenVoices([]));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tts = new WebSpeechTTS();
    const load = () => setVoices(tts.listVoices().filter((v) => v.lang?.startsWith("es")));
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, []);

  const set = <K extends keyof S>(k: K, v: S[K]) => update({ [k]: v } as Partial<S>);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            role="dialog"
            aria-label="Configuración"
            className="fixed z-50 top-0 right-0 h-full w-[min(92vw,380px)] glass holo-border p-5 overflow-y-auto nova-scroll"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium glow-text">Configuración</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-dim hover:text-fg text-xl leading-none">×</button>
            </div>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Apariencia</h3>
              <Row label="Tema">
                <select value={settings.theme} onChange={(e) => set("theme", e.target.value as S["theme"])} className="glass px-2 py-1 text-sm bg-transparent">
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="system">Sistema</option>
                </select>
              </Row>
              <Row label="Color principal"><Color value={settings.primary} onChange={(v) => set("primary", v)} /></Row>
              <Row label="Color de acento"><Color value={settings.accent} onChange={(v) => set("accent", v)} /></Row>
              <Row label="Color del núcleo"><Color value={settings.core} onChange={(v) => set("core", v)} /></Row>
              <Row label="Bordes holográficos"><Color value={settings.border} onChange={(v) => set("border", v)} /></Row>
              <Row label="Glow"><Slider value={settings.glow} min={0} max={1} step={0.05} onChange={(v) => set("glow", v)} /></Row>
              <Row label="Partículas"><Slider value={settings.particles} min={0} max={1} step={0.05} onChange={(v) => set("particles", v)} /></Row>
              <Row label="Animaciones"><Slider value={settings.motion} min={0} max={1} step={0.05} onChange={(v) => set("motion", v)} /></Row>
              <Row label="Efectos reducidos">
                <input type="checkbox" checked={settings.reducedEffects} onChange={(e) => set("reducedEffects", e.target.checked)} className="w-4 h-4 accent-[rgb(var(--nova-primary))]" />
              </Row>
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Voz</h3>
              <Row label="Voz activada">
                <input type="checkbox" checked={settings.voiceEnabled} onChange={(e) => set("voiceEnabled", e.target.checked)} className="w-4 h-4 accent-[rgb(var(--nova-primary))]" />
              </Row>
              <Row label="Activar con 2 palmadas 👏">
                <input type="checkbox" checked={settings.clapEnabled} onChange={(e) => set("clapEnabled", e.target.checked)} className="w-4 h-4 accent-[rgb(var(--nova-primary))]" />
              </Row>
              <Row label="Conversación seguida 🎙️">
                <input type="checkbox" checked={settings.autoListen} onChange={(e) => set("autoListen", e.target.checked)} className="w-4 h-4 accent-[rgb(var(--nova-primary))]" />
              </Row>
              {elevenVoices.length > 0 && (
                <Row label="Voz de ZERO">
                  <select
                    value={settings.ttsVoiceId ?? ""}
                    onChange={(e) => set("ttsVoiceId", e.target.value || null)}
                    className="glass px-2 py-1 text-sm bg-transparent max-w-[10rem]"
                  >
                    <option value="">Por defecto</option>
                    {elevenVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.detail ? ` · ${v.detail}` : ""}
                      </option>
                    ))}
                  </select>
                </Row>
              )}
              <Row label={elevenVoices.length > 0 ? "Voz de repuesto" : "Voz (TTS)"}>
                <select value={settings.voiceName ?? ""} onChange={(e) => set("voiceName", e.target.value || null)} className="glass px-2 py-1 text-sm bg-transparent max-w-[9rem]">
                  <option value="">Automática</option>
                  {voices.map((v) => (<option key={v.name} value={v.name}>{v.name}</option>))}
                </select>
              </Row>
              <Row label="Velocidad"><Slider value={settings.voiceRate} min={0.5} max={2} step={0.1} onChange={(v) => set("voiceRate", v)} /></Row>
              <Row label="Volumen"><Slider value={settings.voiceVolume} min={0} max={1} step={0.05} onChange={(v) => set("voiceVolume", v)} /></Row>
              <Row label="Sonidos">
                <input type="checkbox" checked={settings.sounds} onChange={(e) => set("sounds", e.target.checked)} className="w-4 h-4 accent-[rgb(var(--nova-primary))]" />
              </Row>
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Regional</h3>
              <Row label="Idioma">
                <select value={settings.language} onChange={(e) => set("language", e.target.value)} className="glass px-2 py-1 text-sm bg-transparent">
                  <option value="es-ES">Español (España)</option>
                  <option value="es-MX">Español (México)</option>
                </select>
              </Row>
              <Row label="Zona horaria">
                <span className="text-sm text-faint">{settings.timezone}</span>
              </Row>
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Estado</h3>
              <Diagnostico />
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Datos</h3>
              <DatabaseStatus />
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Integraciones</h3>
              <div className="space-y-2">
                <GoogleConnection />
                <OutlookConnection />
              </div>
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Suscribir el calendario</h3>
              <CalendarFeed />
            </section>

            <section className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wide text-faint mb-1">Notificaciones</h3>
              <NotificationsSetting />
            </section>

            <button onClick={() => update(defaultSettings)} className="w-full glass holo-border py-2 text-sm text-dim hover:text-fg mt-2">
              Restablecer valores
            </button>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
