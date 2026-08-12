"use client";
import { useCallback, useEffect } from "react";
import { useNova } from "@/lib/store";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useAssistant } from "@/hooks/useAssistant";
import { useVoice } from "@/hooks/useVoice";
import { TopBar } from "./TopBar";
import { Monitor } from "./Monitor";
import { NovaCore } from "./NovaCore";
import { Composer } from "./Composer";
import { Settings } from "./Settings";

export function NovaApp() {
  useThemeSync();
  const { send, stopSpeaking } = useAssistant();
  const novaState = useNova((s) => s.novaState);

  const onFinal = useCallback((text: string) => void send(text), [send]);
  const voice = useVoice(onFinal);

  // Push-to-talk toggle on the core.
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
        // No speech recognition: guide user to keyboard.
        useNova.getState().applyTurn(
          { reply: "El reconocimiento de voz no está disponible en este navegador. Puedes escribirme abajo.", view: useNova.getState().view },
          useNova.getState().demoMode,
        );
        voice.stop();
        useNova.getState().setNovaState("idle");
      }
    }
  }, [novaState, voice, stopSpeaking]);

  // Reset volatile state on mount (persisted store keeps settings only).
  useEffect(() => {
    useNova.getState().setNovaState("idle");
    useNova.getState().setView("home");
  }, []);

  return (
    <main className="h-[100dvh] w-full flex flex-col max-w-3xl mx-auto">
      <TopBar />
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 gap-3">
        <Monitor />
        <div className="shrink-0 flex justify-center py-1">
          <NovaCore
            level={voice.level}
            onActivate={activate}
            onActivateHelp="Pulsar para hablar (o Cmd/Ctrl+K para escribir)"
            disabled={novaState === "thinking"}
          />
        </div>
      </div>
      <Composer onSend={(t) => void send(t)} />
      <Settings />
    </main>
  );
}
