/**
 * Client-safe date helpers. Dates are stored UTC and rendered in the
 * viewer's timezone (DESIGN.md §2); wedding-day countdowns render in the
 * wedding's own zone.
 */
import { format, differenceInCalendarDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 Sep" — the list-row date. */
export function shortDate(value: string | Date, timezone?: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return timezone ? formatInTimeZone(date, timezone, "d MMM") : format(date, "d MMM");
}

/** "12 Sep 2026" — detail views. */
export function longDate(value: string | Date, timezone?: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return timezone ? formatInTimeZone(date, timezone, "d MMM yyyy") : format(date, "d MMM yyyy");
}

/** "YYYY-MM-DD" for date inputs, in the viewer's zone. */
export function dayInput(value: string | Date | null | undefined, timezone?: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return timezone ? formatInTimeZone(date, timezone, "yyyy-MM-dd") : format(date, "yyyy-MM-dd");
}

export function todayInput(timezone?: string): string {
  return dayInput(new Date(), timezone);
}

/** "2h", "3d", "just now" — activity rows. */
export function relativeShort(value: string | Date, now = new Date()): string {
  const date = parseDate(value);
  if (!date) return "";
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.round(days / 30)}mo`;
}

/** Whole months between two "YYYY-MM" strings; never negative. */
export function monthsBetweenMonths(fromMonth: string, toMonth: string): number {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) return 0;
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

export function monthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [year, m] = month.split("-").map(Number);
  return format(new Date(Date.UTC(year, m - 1, 1)), "MMMM yyyy");
}

export function addMonths(month: string, count: number): string {
  const [year, m] = month.split("-").map(Number);
  const total = year * 12 + (m - 1) + count;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export interface Countdown {
  /** "11 months to August 2027" or "284 days to 14 August 2027". */
  label: string;
  days: number | null;
  months: number;
}

/**
 * Home header countdown (DESIGN.md §6.1): months to the target month until
 * an exact date is set, then days to that date, both read in the wedding's
 * own timezone.
 */
export function weddingCountdown(
  wedding: { targetMonth: string; weddingDate?: string | Date | null; eventTimezone: string },
  now = new Date(),
): Countdown {
  const zone = wedding.eventTimezone || "UTC";
  const date = parseDate(wedding.weddingDate ?? null);
  const nowMonth = formatInTimeZone(now, zone, "yyyy-MM");

  if (date) {
    const days = differenceInCalendarDays(date, now);
    const pretty = formatInTimeZone(date, zone, "d MMMM yyyy");
    const months = monthsBetweenMonths(nowMonth, formatInTimeZone(date, zone, "yyyy-MM"));
    if (days > 0)
      return { label: `${days} ${days === 1 ? "day" : "days"} to ${pretty}`, days, months };
    if (days === 0) return { label: `Today · ${pretty}`, days, months };
    return { label: `${pretty}`, days, months };
  }

  const months = monthsBetweenMonths(nowMonth, wedding.targetMonth);
  const target = monthLabel(wedding.targetMonth);
  return {
    label: months > 0 ? `${months} ${months === 1 ? "month" : "months"} to ${target}` : target,
    days: null,
    months,
  };
}

/** Due-date tone for payments: overdue = danger, within 7 days = warn. */
export function dueTone(dueDate: string | Date, now = new Date()): "ok" | "warn" | "danger" {
  const date = parseDate(dueDate);
  if (!date) return "ok";
  const days = differenceInCalendarDays(date, now);
  if (days < 0) return "danger";
  if (days <= 7) return "warn";
  return "ok";
}

export function daysUntil(dueDate: string | Date, now = new Date()): number {
  const date = parseDate(dueDate);
  if (!date) return 0;
  return differenceInCalendarDays(date, now);
}

/** "Due 3 Oct · in 5 days" / "Overdue by 2 days". */
export function dueLabel(dueDate: string | Date, timezone?: string, now = new Date()): string {
  const days = daysUntil(dueDate, now);
  const when = shortDate(dueDate, timezone);
  if (days < 0)
    return `${when} · overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
  if (days === 0) return `${when} · today`;
  if (days === 1) return `${when} · tomorrow`;
  return `${when} · in ${days} days`;
}
