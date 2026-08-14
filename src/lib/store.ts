"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AssistantMessage,
  AssistantTurn,
  ConversationState,
  ActionReceipt,
  Proposal,
} from "./providers/types";

export type NovaState =
  | "idle" | "listening" | "transcribing" | "thinking"
  | "planning" | "executing" | "speaking" | "success" | "warning" | "error";

export type MonitorView =
  | "home" | "calendar" | "tasks" | "documents" | "planner" | "briefing" | "history";

export interface Settings {
  theme: "dark" | "light" | "system";
  primary: string; // "r g b"
  accent: string;
  core: string;
  border: string;
  glow: number; // 0..1
  particles: number; // 0..1
  motion: number; // 0..1
  reducedEffects: boolean;
  sounds: boolean;
  voiceEnabled: boolean;
  voiceRate: number; // 0.5..2
  voiceVolume: number; // 0..1
  voiceName: string | null;
  /** Voz fija de ElevenLabs (id). null = la del servidor. Al fijarla aquí,
   *  ZERO suena EXACTAMENTE igual en el móvil, en el Mac y en el PC. */
  /** Double-clap ("estilo JARVIS") activation. Keeps the mic open while idle. */
  clapEnabled: boolean;
  /** Conversación seguida: si ZERO te hace una pregunta, el micro se reabre
   *  solo al terminar de hablar, sin tocar nada. */
  autoListen: boolean;
  language: string;
  timezone: string;
  defaultCalendarId: string;
  defaultTaskListId: string;
}

export const defaultSettings: Settings = {
  theme: "dark",
  primary: "225 6 0",
  accent: "255 59 48",
  core: "235 25 20",
  border: "255 255 255",
  glow: 0.6,
  particles: 1,
  motion: 1,
  reducedEffects: false,
  sounds: true,
  voiceEnabled: true,
  voiceRate: 1,
  voiceVolume: 1,
  voiceName: null,
  clapEnabled: false,
  autoListen: true,
  language: "es-ES",
  timezone: "Europe/Madrid",
  defaultCalendarId: "primary",
  defaultTaskListId: "list-1",
};

interface NovaStore {
  /** Nombre de la cuenta con sesión (no persistido; lo fija NovaApp). */
  userName: string | null;
  setUserName: (n: string | null) => void;
  novaState: NovaState;
  view: MonitorView;
  /** Whether the holographic monitor is dropped down from the top. */
  panelOpen: boolean;
  focusDate: string | null;
  messages: AssistantMessage[];
  conversation: ConversationState;
  transcript: string;
  lastReply: string;
  pendingProposal: Proposal | null;
  receipts: ActionReceipt[];
  demoMode: boolean;
  settingsOpen: boolean;
  paletteOpen: boolean;
  settings: Settings;

  setNovaState: (s: NovaState) => void;
  setView: (v: MonitorView) => void;
  setPanelOpen: (o: boolean) => void;
  setTranscript: (t: string) => void;
  setSettingsOpen: (o: boolean) => void;
  setPaletteOpen: (o: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addReceipts: (r: ActionReceipt[]) => void;
  applyTurn: (turn: AssistantTurn & { state?: ConversationState }, demoMode: boolean) => void;
  pushUser: (content: string) => void;
  reset: () => void;
}

export const useNova = create<NovaStore>()(
  persist(
    (set) => ({
      novaState: "idle",
      view: "home",
      panelOpen: false,
      focusDate: null,
      messages: [],
      conversation: {},
      transcript: "",
      lastReply: "",
      pendingProposal: null,
      receipts: [],
      demoMode: true,
      settingsOpen: false,
      paletteOpen: false,
      settings: defaultSettings,

      setNovaState: (s) => set({ novaState: s }),
      setView: (v) => set({ view: v }),
      setPanelOpen: (o) => set({ panelOpen: o }),
      setTranscript: (t) => set({ transcript: t }),
      setSettingsOpen: (o) => set({ settingsOpen: o }),
      setPaletteOpen: (o) => set({ paletteOpen: o }),
      updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),
      addReceipts: (r) => set((st) => ({ receipts: [...r, ...st.receipts].slice(0, 100) })),
      pushUser: (content) =>
        set((st) => ({
          messages: [...st.messages, { role: "user" as const, content }].slice(-40),
        })),
      applyTurn: (turn, demoMode) =>
        set((st) => ({
          messages: [...st.messages, { role: "assistant" as const, content: turn.reply }].slice(-40),
          conversation: turn.state ?? st.conversation,
          pendingProposal: turn.proposal ?? null,
          view: turn.view ?? st.view,
          // JARVIS behaviour: a view result drops the monitor down from the top.
          panelOpen: turn.view && turn.view !== "home" ? true : st.panelOpen,
          focusDate: turn.focusDate ?? st.focusDate,
          lastReply: turn.reply,
          receipts: turn.receipts ? [...turn.receipts, ...st.receipts].slice(0, 100) : st.receipts,
          demoMode,
        })),
      userName: null,
      setUserName: (n) => set({ userName: n }),
      reset: () => set({ messages: [], conversation: {}, pendingProposal: null, receipts: [], view: "home" }),
    }),
    {
      name: "nova-store",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Only persist settings + history; conversation resets each session.
      partialize: (st) => ({ settings: st.settings, receipts: st.receipts }),
      // Deep-merge settings so a NEW option added in a later release still gets
      // its default for people who already have a persisted store.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { settings?: Partial<Settings>; receipts?: ActionReceipt[] };
        return {
          ...current,
          ...p,
          settings: { ...defaultSettings, ...(p.settings ?? {}) },
        } as NovaStore;
      },
      // v2: rebrand to the Ferrari-red identity — override stale persisted colors.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { settings?: Partial<Settings>; receipts?: ActionReceipt[] };
        return {
          ...p,
          settings: {
            ...defaultSettings,
            ...(p.settings ?? {}),
            primary: defaultSettings.primary,
            accent: defaultSettings.accent,
            core: defaultSettings.core,
            border: defaultSettings.border,
            glow: defaultSettings.glow,
          },
        };
      },
    },
  ),
);
