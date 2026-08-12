"use client";
import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PushState = "unsupported" | "unconfigured" | "default" | "granted" | "denied" | "subscribed";

/** Web Push subscription controller. Permission is requested contextually,
 *  only when the user taps "Activar notificaciones". */
export function usePush() {
  const [state, setState] = useState<PushState>("default");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const cfg = await fetch("/api/push/subscribe").then((r) => r.json()).catch(() => ({ configured: false }));
    if (!cfg.configured) {
      setState("unconfigured");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) setState("subscribed");
    else setState(Notification.permission as PushState);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    const cfg = await fetch("/api/push/subscribe").then((r) => r.json());
    if (!cfg.configured) return setState("unconfigured");

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState(perm as PushState);

    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setState("subscribed");
  }, []);

  const test = useCallback(async () => {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "ZERO", body: "Notificaciones activadas correctamente." }),
    });
  }, []);

  return { state, enable, test, refresh };
}
