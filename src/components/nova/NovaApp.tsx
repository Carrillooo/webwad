"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNova } from "@/lib/store";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useAssistant } from "@/hooks/useAssistant";
import { useVoice } from "@/hooks/useVoice";
import { useClapDetection } from "@/hooks/useClapDetection";
import { TopBar } from "./TopBar";
import { Monitor } from "./Monitor";
import { NovaCore } from "./NovaCore";
import { Composer } from "./Composer";
import { Settings } from "./Settings";

const CENTER_STATES = new Set(["listening", "transcribing", "thinking", "planning"]);

/** Crystal footprint used for the dock↔center flight math. */
const CORE_W = 240;
const CORE_H = 230;

function useViewport() {
  const [size, setSize] = useState({ w: 390, h: 844 });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

export function NovaApp() {
  useThemeSync();
  const { send, stopSpeaking } = useAssistant();
  const novaState = useNova((s) => s.novaState);
  const panelOpen = useNova((s) => s.panelOpen);
  const setPanelOpen = useNova((s) => s.setPanelOpen);
  const { w, h } = useViewport();

  const onFinal = useCallback((text: string) => void send(text), [send]);
  const voice = useVoice(onFinal);

  const activate = useCallback(async () => {
    if (novaState === "speaking") {
      stopSpeaking();
      return;
    }
    if (voice.isActive()) {
      voice.stop();
      useNova.getState().setNovaState("idle");
      return;
    }
    if (novaState === "idle" || novaState === "success" || novaState === "warning" || novaState === "error") {
      const r = await voice.start();
      if (r?.noStt) {
        useNova.getState().applyTurn(
          { reply: "El reconocimiento de voz no está disponible en este navegador. Pulsa el teclado para escribirme.", view: useNova.getState().view },
          useNova.getState().demoMode,
        );
        voice.stop();
        useNova.getState().setNovaState("idle");
      }
    }
  }, [novaState, voice, stopSpeaking]);

  useEffect(() => {
    useNova.getState().setNovaState("idle");
    useNova.getState().setView("home");
  }, []);

  const clapEnabled = useNova((s) => s.settings.clapEnabled);
  useClapDetection(clapEnabled && novaState === "idle", activate);

  const centered = CENTER_STATES.has(novaState);
  const dockScale = w < 520 ? 0.56 : 0.62;
  const centerScale = w < 520 ? 0.94 : 1.08;
  const dock = { x: 4, y: h - CORE_H * dockScale - 6, scale: dockScale };
  const center = { x: w / 2 - CORE_W / 2, y: h / 2 - CORE_H / 2 - 18, scale: centerScale };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <div className="max-w-3xl mx-auto"><TopBar /></div>

      <AnimatePresence>
        {centered && (
          <motion.div
            key="dim"
            aria-hidden
            className="fixed inset-0 z-20"
            style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="panel"
            className="absolute left-3 right-3 z-10 max-w-3xl mx-auto"
            style={{ top: 86, bottom: 104 }}
            initial={{ y: "-108%", opacity: 0.3, filter: "blur(12px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: "-108%", opacity: 0, filter: "blur(12px)" }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          >
            <Monitor onClose={() => setPanelOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed left-0 top-0 z-30"
        initial={false}
        animate={centered ? center : dock}
        transition={{ type: "spring", stiffness: 230, damping: 26 }}
        style={{ width: CORE_W }}
      >
        <NovaCore
          level={voice.level}
          onActivate={activate}
          onActivateHelp={clapEnabled ? "Pulsa o da dos palmadas" : "Pulsar para hablar"}
          showHint={centered}
          disabled={novaState === "thinking"}
        />
      </motion.div>

      <Composer onSend={(t) => void send(t)} />
      <Settings />
    </main>
  );
}
