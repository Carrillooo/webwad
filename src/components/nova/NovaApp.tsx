"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNova } from "@/lib/store";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useAssistant } from "@/hooks/useAssistant";
import { useVoice } from "@/hooks/useVoice";
import { useClapDetection } from "@/hooks/useClapDetection";
import { usePushToTalkKey } from "@/hooks/usePushToTalkKey";
import { useAutoListen } from "@/hooks/useAutoListen";
import { playActivationBeep } from "@/lib/sound";
import { TopBar } from "./TopBar";
import { Monitor } from "./Monitor";
import { NovaCore } from "./NovaCore";
import { Composer } from "./Composer";
import { Resting } from "./Resting";
import { Settings } from "./Settings";
import { OAuthNotice } from "./OAuthNotice";
import { AuthScreen, PaywallScreen } from "./AuthScreen";
import { useAccount } from "@/hooks/useAccount";
import { ASK_EVENT } from "@/lib/events";

const CENTER_STATES = new Set(["listening", "transcribing", "thinking", "planning"]);

/** Crystal footprint used for the dock↔center flight math. */
const CORE_W = 240;
const CORE_H = 230;

/**
 * El ESCENARIO: el rectángulo realmente utilizable, ya descontadas las zonas
 * seguras del móvil (notch arriba, barra de gestos abajo).
 *
 * No vale `window.innerHeight`: el <body> lleva el relleno de las safe areas,
 * así que la pantalla útil es más corta y empieza más abajo. Usando el alto
 * de ventana, la piedra —que va en `fixed`, o sea en coordenadas de pantalla—
 * se metía debajo de la barra de gestos de un iPhone.
 */
function useEscenario() {
  const [caja, setCaja] = useState({ x: 0, y: 0, w: 390, h: 844 });
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) setCaja({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);
  return [ref, caja] as const;
}

/**
 * Alto real de la cabecera. Estaba a 86 px fijos y el monitor se comía la
 * línea de la fecha; con el texto ampliado (ajuste de accesibilidad) el
 * destrozo era mayor. Medido, encaja siempre.
 *
 * Va con ref de callback a propósito: la cabecera no existe en el primer
 * render (antes está la puerta de sesión), así que un efecto con ref normal
 * se quedaba con el valor por defecto para siempre.
 */
function useAltoMedido(porDefecto: number) {
  const [alto, setAlto] = useState(porDefecto);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    // Se conserva el último alto conocido: cuando el bloque desaparece (ZERO
    // se pone a escuchar) su alto pasaría a 0 y la piedra daría un salto.
    const medir = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setAlto(h);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, alto] as const;
}

export function NovaApp() {
  useThemeSync();
  const { account, gate, espera, refresh, logout, me } = useAccount();
  const { send, stopSpeaking } = useAssistant();
  const novaState = useNova((s) => s.novaState);
  const panelOpen = useNova((s) => s.panelOpen);
  const setPanelOpen = useNova((s) => s.setPanelOpen);
  const [escenarioRef, escenario] = useEscenario();
  const { w, h } = { w: escenario.w, h: escenario.h };
  const [headerRef, headerH] = useAltoMedido(86);
  const [reposoRef, reposoH] = useAltoMedido(0);
  const quieto = useReducedMotion();
  // Muelle crítico (sin rebote): lo que se coloca, se coloca. El rebote se
  // reserva para lo que el usuario ha lanzado con el dedo.
  const muelle = quieto
    ? { duration: 0.14 }
    : ({ type: "spring", stiffness: 230, damping: 30 } as const);

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
      playActivationBeep();
      const r = await voice.start();
      if (r?.micDenied) {
        // El navegador NO vuelve a preguntar cuando el permiso quedó
        // bloqueado: hay que decir exactamente dónde desbloquearlo.
        const MIC_MSGS: Record<string, string> = {
          denied:
            "El navegador tiene el micrófono bloqueado para esta web. Pulsa el candado 🔒 junto a la dirección → Micrófono → Permitir, recarga y prueba otra vez. Si sigue igual, revisa también los ajustes de privacidad del ordenador (Micrófono → permite el navegador).",
          unsupported:
            "Este navegador no permite usar el micrófono aquí. Abre ZERO en Chrome, Edge o Safari actualizados (y siempre por https).",
          nomic:
            "No encuentro ningún micrófono en este equipo. Conecta o activa uno y vuelve a intentarlo.",
          error:
            "El micrófono no arrancó. Cierra otras aplicaciones que lo estén usando (llamadas, grabadoras) y prueba de nuevo.",
        };
        useNova.getState().applyTurn(
          { reply: MIC_MSGS[r.reason ?? "error"] ?? MIC_MSGS.error, view: useNova.getState().view },
          useNova.getState().demoMode,
        );
        useNova.getState().setNovaState("warning");
        setTimeout(() => {
          if (useNova.getState().novaState === "warning") useNova.getState().setNovaState("idle");
        }, 2500);
        return;
      }
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

  // Atajos de la pantalla de inicio: un toque equivale a decirlo en voz alta.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === "string" && text.trim()) void send(text.trim());
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [send]);

  // El saludo y la IA usan el nombre de la cuenta con sesión.
  useEffect(() => {
    useNova.getState().setUserName(account?.name ?? null);
  }, [account]);

  const clapEnabled = useNova((s) => s.settings.clapEnabled);
  useClapDetection(clapEnabled && novaState === "idle", activate);

  // Space bar = push-to-talk on desktop.
  usePushToTalkKey(activate);

  // Conversación seguida: si ZERO acaba con una pregunta, reabre el micro solo.
  const autoListen = useNova((s) => s.settings.autoListen);
  useAutoListen(autoListen, activate);

  const centered = CENTER_STATES.has(novaState);
  const mobile = w < 640;
  const dockScale = mobile ? 0.74 : 0.62;
  const centerScale = w < 520 ? 0.94 : 1.08;
  // Con el monitor abierto en móvil, la piedra y el contenido se peleaban por
  // la misma mitad de pantalla: se recoge a una esquina y devuelve ~200 px de
  // sitio útil. Vuela con el mismo muelle, así que se entiende que es la misma.
  const compact = mobile && panelOpen;
  // En móvil la piedra se centra en el HUECO que queda (entre el bloque de
  // reposo y el botón del teclado), no a un offset fijo del fondo. Con un
  // offset fijo, en un iPhone alto quedaban 400 px de nada en medio.
  // El escalado no mueve el centro del contenedor, así que basta con centrar.
  const arribaLibre = headerH + reposoH;
  const hueco = Math.max(CORE_H * dockScale, h - arribaLibre - 96);
  // La piedra va en `fixed`: sus coordenadas son de pantalla, así que hay que
  // sumarles dónde empieza el escenario (debajo del notch).
  const X = escenario.x;
  const Y = escenario.y;
  // El `scale` de Motion escala desde el CENTRO del contenedor, así que el
  // borde de abajo no está en `y + alto*escala`. Sin esta cuenta, la piedra
  // recogida se salía por debajo de la pantalla en un iPhone.
  const anclarAbajo = (escala: number, margen: number) =>
    Y + h - margen - CORE_H / 2 - (CORE_H * escala) / 2;
  const dock = compact
    ? { x: X + 2, y: anclarAbajo(0.5, 12), scale: 0.5 }
    : mobile
      ? { x: X + w / 2 - CORE_W / 2, y: Y + arribaLibre + hueco / 2 - CORE_H / 2, scale: dockScale }
      : { x: X + 4, y: anclarAbajo(dockScale, 24), scale: dockScale };
  const center = { x: X + w / 2 - CORE_W / 2, y: Y + h / 2 - CORE_H / 2 - 68, scale: centerScale };

  // Puerta de la app de pago: sin sesión → entrar; prueba caducada → plan.
  if (gate === "loading") {
    return (
      <main className="h-full grid place-items-center">
        <p className="text-faint text-sm tracking-[0.4em]">ZERO</p>
      </main>
    );
  }
  // El servidor ha pedido esperar (demasiadas peticiones seguidas). Antes esto
  // dejaba la app abierta pero sin datos y sin explicación ninguna.
  if (gate === "espera") {
    return (
      <main className="h-full grid place-items-center px-8 text-center">
        <div className="space-y-3 max-w-xs">
          <p className="text-base font-semibold">Un momento</p>
          <p className="text-sm text-dim leading-relaxed">
            Has hecho muchas peticiones seguidas y ZERO ha frenado un poco para protegerse.
            Vuelve a intentarlo en {espera && espera > 90 ? `${Math.ceil(espera / 60)} minutos` : "unos segundos"}.
          </p>
          <button
            onClick={() => void refresh()}
            className="glass-solid px-4 py-2 rounded-xl text-sm font-medium"
          >
            Reintentar ahora
          </button>
        </div>
      </main>
    );
  }
  if (gate === "auth") return <AuthScreen onDone={refresh} oauth={me?.oauth} />;
  if (gate === "paywall") return <PaywallScreen email={account?.email ?? ""} onLogout={logout} />;

  return (
    // `h-full` y no `100dvh`: el <body> ya lleva el relleno de las zonas
    // seguras, así que con 100dvh el escenario se salía 93 px por debajo de la
    // pantalla en un iPhone con notch — y con él, el monitor y la piedra.
    <main ref={escenarioRef} className="relative h-full w-full overflow-hidden">
      <div ref={headerRef} className="max-w-3xl mx-auto"><TopBar /></div>

      <AnimatePresence>
        {centered && (
          <motion.div
            key="dim"
            aria-hidden
            className="fixed inset-0 z-20"
            style={{ background: "rgb(8 8 12 / 0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="panel"
            className="absolute left-3 right-3 z-10 max-w-3xl mx-auto"
            // El monitor empieza justo debajo de la cabecera medida, y en
            // móvil acaba por encima de la piedra recogida.
            style={{ top: headerH + 8, bottom: compact ? 128 : 104 }}
            // Un material no aparece: se materializa. Desenfoque y escala
            // juntos, y entra y sale por el MISMO sitio (arriba), que es de
            // donde lo saca el botón del monitor.
            initial={{ y: "-104%", opacity: 0, filter: "blur(14px)", scale: 0.97 }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ y: "-104%", opacity: 0, filter: "blur(14px)", scale: 0.97 }}
            transition={
              quieto
                ? { duration: 0.16 }
                : { type: "spring", stiffness: 210, damping: 30, opacity: { duration: 0.2 } }
            }
          >
            <Monitor onClose={() => setPanelOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed left-0 top-0 z-30"
        initial={false}
        animate={centered ? center : dock}
        transition={muelle}
        style={{ width: CORE_W }}
      >
        <NovaCore
          level={voice.level}
          onActivate={activate}
          onActivateHelp={clapEnabled ? "Pulsa o da dos palmadas" : "Pulsar para hablar"}
          // Antes la piedra estaba muda en reposo: quien abría ZERO por
          // primera vez veía una roca negra y ninguna pista de qué hacer.
          showHint={!compact}
          disabled={novaState === "thinking"}
        />
      </motion.div>

      <div ref={reposoRef}>
        <Resting />
      </div>
      <Composer onSend={(t) => void send(t)} />
      <Settings />
      <OAuthNotice />
    </main>
  );
}
