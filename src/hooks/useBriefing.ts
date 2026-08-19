"use client";
import { useEffect, useState } from "react";
import { useNova } from "@/lib/store";
import type { CalendarEvent, TaskItem } from "@/lib/providers/types";

interface Briefing {
  events: CalendarEvent[];
  tasks: TaskItem[];
  nextEvent: CalendarEvent | null;
  mainFreeSlot: { start: string; end: string; minutes: number } | null;
}

export function useBriefing() {
  const receipts = useNova((s) => s.receipts);
  const [data, setData] = useState<Briefing | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/briefing")
      .then((r) => (r.ok ? r.json() : null))
      // Si la recarga falla (o el servidor pide esperar) se CONSERVA lo último
      // que se supo. Antes se ponía a null y la línea del día desaparecía de
      // golpe delante del usuario, como si se hubiera roto algo.
      .then((d) => {
        if (alive && d && Array.isArray(d.events)) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [receipts]);
  return data;
}
