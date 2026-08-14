"use client";
import { useEffect } from "react";

/**
 * Monta los ganchos globales de error del navegador y los manda a /api/log.
 * Máximo 5 por sesión de página para no inundar si algo entra en bucle.
 */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const report = (message: string, stack?: string) => {
      if (sent >= 5) return;
      sent++;
      void fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.slice(0, 600),
          stack: stack?.slice(0, 2000),
          url: window.location.pathname,
        }),
        keepalive: true,
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => report(e.message || "error", e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : String(r).slice(0, 600), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
