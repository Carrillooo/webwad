"use client";
import { useEffect } from "react";

/**
 * Tema ÚNICO y fijo: blanco. La interfaz ya no es personalizable — los
 * colores y efectos viven como valores por defecto en globals.css y no hay
 * ajustes de apariencia que los cambien.
 */
export function useThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    // Respeta la preferencia del sistema de reducir movimiento.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.setAttribute("data-effects", reduced ? "reduced" : "full");
  }, []);
}
