"use client";
import { useCallback, useEffect, useState } from "react";
import { useNova } from "@/lib/store";
import type { CalendarEvent, CalendarRef, TaskItem, DriveFile } from "@/lib/providers/types";

/** Fetches monitor data and refreshes whenever receipts change (after actions). */
export function useCalendarData(date: string | null, range: "day" | "week" | "month" = "day") {
  const receipts = useNova((s) => s.receipts);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarRef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = date ?? new Date().toISOString();
    const res = await fetch(`/api/calendar?range=${range}&date=${encodeURIComponent(d)}`);
    const data = await res.json();
    setEvents(data.events ?? []);
    setCalendars(data.calendars ?? []);
    setLoading(false);
  }, [date, range]);

  useEffect(() => {
    load();
  }, [load, receipts]);

  return { events, calendars, loading, reload: load };
}

export function useTasksData() {
  const receipts = useNova((s) => s.receipts);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, receipts]);

  return { tasks, loading, reload: load };
}

export function useDocumentsData(query: string) {
  const receipts = useNova((s) => s.receipts);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const res = await fetch(`/api/documents${q}`);
    const data = await res.json();
    setFiles(data.files ?? []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    load();
  }, [load, receipts]);

  return { files, loading, reload: load };
}
