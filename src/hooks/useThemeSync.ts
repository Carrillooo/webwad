"use client";
import { useEffect } from "react";
import { useNova } from "@/lib/store";

/** Pushes Settings → CSS variables + data attributes on <html>, live. */
export function useThemeSync() {
  const settings = useNova((s) => s.settings);

  useEffect(() => {
    const root = document.documentElement;
    const s = settings;

    // Theme resolution (system uses prefers-color-scheme)
    let theme = s.theme;
    if (theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-effects", s.reducedEffects ? "reduced" : "full");

    root.style.setProperty("--nova-primary", s.primary);
    root.style.setProperty("--nova-accent", s.accent);
    root.style.setProperty("--nova-core", s.core);
    root.style.setProperty("--nova-border", s.border);
    root.style.setProperty("--nova-glow", String(s.glow));
    root.style.setProperty("--nova-particles", String(s.reducedEffects ? Math.min(0.3, s.particles) : s.particles));
    root.style.setProperty("--nova-motion", String(s.reducedEffects ? Math.min(0.3, s.motion) : s.motion));
  }, [settings]);
}
