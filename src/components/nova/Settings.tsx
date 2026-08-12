"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNova, defaultSettings, type Settings as S } from "@/lib/store";
import { WebSpeechTTS } from "@/lib/providers/speech/browser";

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

export function Settings() {
  const open = useNova((s) => s.settingsOpen);
  const setOpen = useNova((s) => s.setSettingsOpen);
  const settings = useNova((s) => s.settings);
  const update = useNova((s) => s.updateSettings);
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);

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
              <Row label="Voz (TTS)">
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

            <button onClick={() => update(defaultSettings)} className="w-full glass holo-border py-2 text-sm text-dim hover:text-fg mt-2">
              Restablecer valores
            </button>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
