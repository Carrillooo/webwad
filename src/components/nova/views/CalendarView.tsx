"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { useNova } from "@/lib/store";
import { useCalendarData } from "@/hooks/useNovaData";
import { humanTime, humanDay, minutesOfDay, makeZonedInstant, zonedToUtc, TZ } from "@/lib/datetime";
import type { CalendarEvent } from "@/lib/providers/types";

const DAY_START = 7; // 07:00
const DAY_END = 23; // 23:00
const HOURS = DAY_END - DAY_START;

type Mode = "day" | "week" | "month";

/** Madrid wall-clock parts for grouping/labels, independent of viewer TZ. */
function zoned(d: Date | string): Date {
  return toZonedTime(typeof d === "string" ? new Date(d) : d, TZ);
}
function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
/** Real instant for the start of a zoned wall-clock day. */
function instantOf(zonedDay: Date): string {
  return zonedToUtc(startOfDay(zonedDay)).toISOString();
}

/** Calendar with day timeline + week and month overviews (Europe/Madrid). */
export function CalendarView() {
  const focusDate = useNova((s) => s.focusDate);
  const pendingProposal = useNova((s) => s.pendingProposal);
  const [mode, setMode] = useState<Mode>("day");
  const [cursor, setCursor] = useState<string>(focusDate ?? new Date().toISOString());

  // A new assistant result re-focuses the day view on the mentioned date.
  useEffect(() => {
    if (focusDate) {
      setCursor(focusDate);
      setMode("day");
    }
  }, [focusDate]);

  const { events, loading } = useCalendarData(cursor, mode);
  const zCursor = zoned(cursor);
  const todayKey = dayKey(zoned(new Date()));

  const shift = (dir: 1 | -1) => {
    if (mode === "month") {
      // Anchor mid-month so the ±31d fetch window covers the whole grid.
      setCursor(makeZonedInstant(zCursor.getFullYear(), zCursor.getMonth() + 1 + dir, 15).toISOString());
    } else {
      setCursor(zonedToUtc(addDays(zCursor, mode === "day" ? dir : dir * 7)).toISOString());
    }
  };
  const goToday = () => setCursor(new Date().toISOString());
  const openDay = (zonedDay: Date) => {
    setCursor(instantOf(zonedDay));
    setMode("day");
  };
  const switchMode = (m: Mode) => {
    if (m === "month") {
      setCursor(makeZonedInstant(zCursor.getFullYear(), zCursor.getMonth() + 1, 15).toISOString());
    }
    setMode(m);
  };

  const title =
    mode === "day"
      ? humanDay(new Date(cursor))
      : mode === "week"
        ? weekLabel(zCursor)
        : format(zCursor, "LLLL yyyy", { locale: es });

  return (
    <div className="h-full flex flex-col">
      {/* Navigation header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <button onClick={() => shift(-1)} aria-label="Anterior" className="glass w-7 h-7 grid place-items-center text-dim hover:text-fg rounded-lg">‹</button>
        <button onClick={() => shift(1)} aria-label="Siguiente" className="glass w-7 h-7 grid place-items-center text-dim hover:text-fg rounded-lg">›</button>
        <button onClick={goToday} className="glass px-2.5 h-7 text-[11px] text-dim hover:text-fg rounded-lg">Hoy</button>
        <h2 className="text-sm font-medium capitalize flex-1 truncate">{title}</h2>
        <div className="flex gap-0.5">
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              aria-current={mode === m}
              className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
              style={mode === m ? { background: "rgb(var(--nova-primary) / 0.22)" } : { color: "var(--fg-faint)" }}
            >
              {m === "day" ? "Día" : m === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {mode === "day" && <DayTimeline events={events} proposal={pendingProposal?.blocks ?? []} />}
      {mode === "week" && <WeekGrid zCursor={zCursor} events={events} todayKey={todayKey} onOpenDay={openDay} />}
      {mode === "month" && <MonthGrid zCursor={zCursor} events={events} todayKey={todayKey} onOpenDay={openDay} />}

      {loading && <p className="text-xs text-faint mt-2 shrink-0">Cargando agenda…</p>}
    </div>
  );
}

function weekLabel(z: Date): string {
  const start = startOfWeek(z, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "d", { locale: es })}–${format(end, "d LLLL", { locale: es })}`
    : `${format(start, "d LLL", { locale: es })} – ${format(end, "d LLL", { locale: es })}`;
}

// ------------------------------- Day -------------------------------

function DayTimeline({
  events,
  proposal,
}: {
  events: CalendarEvent[];
  proposal: { title: string; start: string; end: string }[];
}) {
  const pos = (iso: string) => ((minutesOfDay(new Date(iso)) - DAY_START * 60) / (HOURS * 60)) * 100;
  const height = (s: string, e: string) =>
    Math.max(3.5, ((new Date(e).getTime() - new Date(s).getTime()) / 60000 / (HOURS * 60)) * 100);

  return (
    <div className="relative flex-1 overflow-y-auto nova-scroll pr-1">
      <div className="flex items-baseline justify-end mb-1">
        <span className="text-xs text-faint">{events.length} eventos</span>
      </div>
      <div className="relative" style={{ height: `${HOURS * 56}px` }}>
        {Array.from({ length: HOURS + 1 }).map((_, i) => (
          <div key={i} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: `${(i / HOURS) * 100}%` }}>
            <span className="text-[10px] text-faint w-9 tabular-nums">{String(DAY_START + i).padStart(2, "0")}:00</span>
            <span className="flex-1 h-px" style={{ background: "rgb(var(--nova-border) / 0.10)" }} />
          </div>
        ))}

        {proposal.map((b, i) => (
          <motion.div
            key={`p-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute left-12 right-2 rounded-xl px-3 py-1 text-xs"
            style={{
              top: `${pos(b.start)}%`,
              height: `${height(b.start, b.end)}%`,
              border: "1px dashed rgb(var(--nova-accent) / 0.7)",
              background: "rgb(var(--nova-accent) / 0.10)",
            }}
          >
            <span className="opacity-80">{b.title} · propuesto</span>
          </motion.div>
        ))}

        {events.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="absolute left-12 right-2 rounded-xl px-3 py-1.5 overflow-hidden holo-border"
            style={{
              top: `${pos(e.start)}%`,
              height: `${height(e.start, e.end)}%`,
              background: "rgb(var(--nova-primary) / 0.16)",
              boxShadow: "0 0 20px rgb(var(--nova-primary) / calc(0.25 * var(--nova-glow)))",
            }}
          >
            <div className="text-sm font-medium truncate">{e.title}</div>
            <div className="text-[11px] text-dim tabular-nums">
              {humanTime(e.start)}–{humanTime(e.end)}
              {e.location ? ` · ${e.location}` : ""}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------- Week ------------------------------

function WeekGrid({
  zCursor,
  events,
  todayKey,
  onOpenDay,
}: {
  zCursor: Date;
  events: CalendarEvent[];
  todayKey: string;
  onOpenDay: (z: Date) => void;
}) {
  const weekStart = startOfWeek(zCursor, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(zoned(e.start));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  const pos = (iso: string) => Math.min(96, Math.max(0, ((minutesOfDay(new Date(iso)) - DAY_START * 60) / (HOURS * 60)) * 100));
  const height = (s: string, e: string) =>
    Math.max(4, ((new Date(e).getTime() - new Date(s).getTime()) / 60000 / (HOURS * 60)) * 100);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const k = dayKey(d);
        const dayEvents = (byDay.get(k) ?? []).sort((a, b) => a.start.localeCompare(b.start));
        const isToday = k === todayKey;
        return (
          <motion.button
            key={k}
            type="button"
            onClick={() => onOpenDay(d)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex flex-col min-h-0 rounded-xl overflow-hidden text-left"
            style={{
              background: "rgb(var(--panel) / 0.04)",
              border: isToday ? "1px solid rgb(var(--nova-primary) / 0.6)" : "1px solid rgb(var(--nova-border) / 0.10)",
            }}
            aria-label={`Abrir ${format(d, "EEEE d", { locale: es })}`}
          >
            <div className="text-center py-1.5 shrink-0">
              <div className="text-[9px] uppercase text-faint">{format(d, "EEE", { locale: es })}</div>
              <div className={`text-sm tabular-nums ${isToday ? "glow-text font-semibold" : ""}`} style={isToday ? { color: "rgb(var(--nova-primary))" } : undefined}>
                {format(d, "d")}
              </div>
            </div>
            <div className="relative flex-1 min-h-0 mx-0.5 mb-0.5">
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  title={`${e.title} ${humanTime(e.start)}`}
                  className="absolute left-0 right-0 rounded-[4px] overflow-hidden px-0.5"
                  style={{
                    top: `${pos(e.start)}%`,
                    height: `${height(e.start, e.end)}%`,
                    background: "rgb(var(--nova-primary) / 0.35)",
                    boxShadow: "0 0 6px rgb(var(--nova-primary) / 0.35)",
                  }}
                >
                  <span className="text-[8px] leading-tight block truncate">{e.title}</span>
                </div>
              ))}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ------------------------------- Month -----------------------------

function MonthGrid({
  zCursor,
  events,
  todayKey,
  onOpenDay,
}: {
  zCursor: Date;
  events: CalendarEvent[];
  todayKey: string;
  onOpenDay: (z: Date) => void;
}) {
  const monthIdx = zCursor.getMonth();
  const first = new Date(zCursor.getFullYear(), monthIdx, 1);
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const k = dayKey(zoned(e.start));
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [events]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="grid grid-cols-7 mb-1 shrink-0">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-center text-[10px] text-faint">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
        {cells.map((d, i) => {
          const k = dayKey(d);
          const count = countByDay.get(k) ?? 0;
          const inMonth = d.getMonth() === monthIdx;
          const isToday = k === todayKey;
          return (
            <motion.button
              key={k}
              type="button"
              onClick={() => onOpenDay(d)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.008, 0.3) }}
              className="rounded-lg flex flex-col items-center justify-start pt-1 gap-0.5 min-h-0"
              style={{
                background: "rgb(var(--panel) / 0.04)",
                border: isToday ? "1px solid rgb(var(--nova-primary) / 0.6)" : "1px solid rgb(var(--nova-border) / 0.08)",
                opacity: inMonth ? 1 : 0.32,
              }}
              aria-label={`Abrir ${format(d, "d LLLL", { locale: es })}`}
            >
              <span
                className={`text-[11px] tabular-nums ${isToday ? "font-semibold glow-text" : ""}`}
                style={isToday ? { color: "rgb(var(--nova-primary))" } : undefined}
              >
                {format(d, "d")}
              </span>
              {count > 0 && (
                <span className="flex items-center gap-[2px]">
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <span key={j} className="w-1 h-1 rounded-full" style={{ background: "rgb(var(--nova-primary))", boxShadow: "0 0 4px rgb(var(--nova-primary))" }} />
                  ))}
                  {count > 3 && <span className="text-[8px] text-dim">+{count - 3}</span>}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
