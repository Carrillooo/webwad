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

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me");
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

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.reload();
    }
  }, []);

  const account = me?.account ?? null;
  const gate: "loading" | "auth" | "paywall" | null = loading
    ? "loading"
    : me?.authRequired && !account
      ? "auth"
      : account && account.subscription.status === "expired"
        ? "paywall"
        : null;

  return { loading, me, account, gate, refresh, logout };
}
