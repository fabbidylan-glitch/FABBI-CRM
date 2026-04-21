/**
 * Business-hours-aware scheduling.
 *
 * The auto-task engine says things like "follow up in 48 hours". Raw time
 * math lands that 48h on a Saturday night. Reps never see it; tasks pile up
 * looking overdue Monday morning. This helper adds `hours` while skipping
 * nights and weekends so "due in 48h" lands at a workable moment.
 *
 * Work day: 9am–6pm in America/New_York (US East, FABBI's base tz). Weekends
 * are skipped entirely. Holidays are not handled (low ROI — maybe later).
 */

const WORK_START_HOUR = 9; // 9am
const WORK_END_HOUR = 18; // 6pm
const WORK_TZ = "America/New_York";

/**
 * Returns a Date N business-hours in the future, in UTC. Works across DST
 * transitions because we read hour/weekday via Intl in the target tz.
 */
export function addBusinessHours(from: Date, hours: number): Date {
  if (!Number.isFinite(hours) || hours <= 0) return from;

  let cursor = new Date(from.getTime());
  let remaining = hours;

  while (remaining > 0) {
    cursor = rollForwardToWorkWindow(cursor);
    const endOfDay = endOfWorkDay(cursor);
    const availableMs = endOfDay.getTime() - cursor.getTime();
    const availableHours = availableMs / 3_600_000;

    if (remaining <= availableHours) {
      return new Date(cursor.getTime() + remaining * 3_600_000);
    }
    // Used up today's window — jump to next morning.
    remaining -= availableHours;
    cursor = nextMorning(endOfDay);
  }
  return cursor;
}

/** Push a Date forward until it's inside a work window (9–6, M–F). */
function rollForwardToWorkWindow(d: Date): Date {
  let cur = new Date(d.getTime());
  for (let i = 0; i < 14; i++) {
    const { weekday, hour } = partsInTz(cur);
    if (weekday === "Sat") {
      cur = nextMorning(cur, 2); // skip Sat+Sun → Mon
      continue;
    }
    if (weekday === "Sun") {
      cur = nextMorning(cur, 1);
      continue;
    }
    if (hour < WORK_START_HOUR) {
      cur = setTzHour(cur, WORK_START_HOUR);
      continue;
    }
    if (hour >= WORK_END_HOUR) {
      cur = nextMorning(cur);
      continue;
    }
    return cur;
  }
  return cur;
}

function endOfWorkDay(d: Date): Date {
  return setTzHour(d, WORK_END_HOUR);
}

function nextMorning(d: Date, addDays = 1): Date {
  // Move to `addDays` later at the start of the work window.
  const shifted = new Date(d.getTime() + addDays * 24 * 3_600_000);
  return setTzHour(shifted, WORK_START_HOUR);
}

/** Rebuild `d` at a specific hour (0-23) in WORK_TZ, preserving date. */
function setTzHour(d: Date, hour: number): Date {
  const { year, month, day } = partsInTz(d);
  // Build an ISO with the desired local hour, then parse in the target tz.
  // Simplest reliable approach: use the Intl formatter to discover the
  // current UTC offset for that date, then construct UTC from it.
  const tzDate = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
  const offsetMinutes = tzOffsetMinutes(tzDate);
  return new Date(tzDate.getTime() - offsetMinutes * 60_000);
}

function partsInTz(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: WORK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: parts.weekday as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
  };
}

/** Offset (minutes) between UTC and WORK_TZ at the given instant. */
function tzOffsetMinutes(d: Date): number {
  // Compare "same wall-clock moment" interpreted as UTC vs as WORK_TZ.
  const utcParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: WORK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const utcMs = Date.UTC(
    pick(utcParts, "year"),
    pick(utcParts, "month") - 1,
    pick(utcParts, "day"),
    pick(utcParts, "hour"),
    pick(utcParts, "minute"),
    pick(utcParts, "second")
  );
  const tzMs = Date.UTC(
    pick(tzParts, "year"),
    pick(tzParts, "month") - 1,
    pick(tzParts, "day"),
    pick(tzParts, "hour"),
    pick(tzParts, "minute"),
    pick(tzParts, "second")
  );
  return (tzMs - utcMs) / 60_000;
}
