"use client";
import { useEffect } from "react";
import { useNova } from "@/lib/store";

/**
 * Tema ÚNICO y fijo: blanco. La interfaz no es personalizable — los colores y
 * efectos viven como valores por defecto en globals.css.
 *
 * Lo único que sí manda el usuario es la ACCESIBILIDAD: tamaño del texto y
 * alto contraste. Eso no es decoración: es lo que permite usar la app con la
 * vista cansada o a plena luz.
 */
export function useThemeSync() {
  const fontScale = useNova((s) => s.settings.fontScale);
  const highContrast = useNova((s) => s.settings.highContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    // Respeta la preferencia del sistema de reducir movimiento.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.setAttribute("data-effects", reduced ? "reduced" : "full");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // La escala mueve el tamaño base y con él TODA la interfaz (Tailwind mide
    // en rem): texto, botones y espacios crecen a la vez.
    root.style.setProperty("--nova-font-scale", String(fontScale ?? 1));
    root.setAttribute("data-contrast", highContrast ? "high" : "normal");
  }, [fontScale, highContrast]);
}
