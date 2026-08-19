"use client";
import { useCallback, useEffect, useState } from "react";

export interface AccountInfo {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  subscription: { status: "active" | "trial" | "expired"; daysLeft: number | null; trialEndsAt: string | null };
  plan: { name: string; priceEur: number; trialDays: number };
}

interface MeResponse {
  authRequired: boolean;
  demoMode: boolean;
  plan: { name: string; priceEur: number; trialDays: number };
  /** Proveedores con «Continuar con…» disponibles. */
  oauth?: { google: boolean; microsoft: boolean };
  account: AccountInfo | null;
}

/**
 * Estado de la cuenta para decidir qué se enseña: la app, la pantalla de
 * entrada o el muro del plan. En desarrollo sin base de datos, authRequired
 * llega en false y la app abre directamente en demo.
 */
export function useAccount() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [espera, setEspera] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me");
      if (r.status === 429) {
        // ANTES esto metía la respuesta de error como si fueran datos de la
        // cuenta: `authRequired` y `plan` llegaban indefinidos y la app abría
        // medio rota, sin decir nada. Ahora se reconoce y se avisa.
        const d = await r.json().catch(() => ({}));
        setEspera(Math.max(5, Number(d.retryAfter) || 60));
        return;
      }
      if (!r.ok) throw new Error(`estado ${r.status}`);
      setEspera(null);
      setMe(await r.json());
    } catch {
      // Sin red no bloqueamos la app: se comporta como demo local.
      setMe({ authRequired: false, demoMode: true, plan: { name: "ZERO Pro", priceEur: 20, trialDays: 14 }, account: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Si el servidor pidió esperar, se reintenta solo: sin esto la app se
  // quedaba clavada hasta que la persona recargaba a mano.
  useEffect(() => {
    if (espera === null) return;
    const id = window.setTimeout(() => void refresh(), Math.min(espera, 60) * 1000);
    return () => window.clearTimeout(id);
  }, [espera, refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.reload();
    }
  }, []);

  const account = me?.account ?? null;
  const gate: "loading" | "auth" | "paywall" | "espera" | null = loading
    ? "loading"
    : espera !== null && !me
      ? "espera"
      : me?.authRequired && !account
        ? "auth"
        : account && account.subscription.status === "expired"
          ? "paywall"
          : null;

  return { loading, me, account, gate, espera, refresh, logout };
}
