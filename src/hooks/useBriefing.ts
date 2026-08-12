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
      .then((r) => r.json())
      .then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [receipts]);
  return data;
}
