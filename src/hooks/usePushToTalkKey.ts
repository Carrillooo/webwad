"use client";
import { useEffect, useRef } from "react";

/**
 * Space bar = push-to-talk on desktop. Ignored while typing in an input,
 * textarea or contenteditable so the composer keeps working normally.
 */
export function usePushToTalkKey(onActivate: () => void, enabled = true) {
  const cbRef = useRef(onActivate);
  useEffect(() => {
    cbRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      cbRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
