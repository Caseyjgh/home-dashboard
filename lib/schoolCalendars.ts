// schoolCalendars.ts
// 2026-2027 school-day rotation data decoded from the attached source calendars.
//
// IMPORTANT:
// - This file intentionally stores explicit dates instead of calculating an alternating pattern.
// - WCA source: "2026-2027 Navy/Green Calendar"
// - WHS source: "Maroon & Gold Rotation 2026-2027"
// - WHS special-color / "T" dates are NOT classified as Maroon or Gold because the supplied
//   WHS calendar does not include a legend explaining those special markings.
// - Dates not explicitly mapped to a rotation return null unless they are explicitly listed
//   as WCA no-school dates below.

export type WcaDayType = "blue" | "green" | "no-school";
export type WhsDayType = "maroon" | "gold";

export const SCHOOL_TIME_ZONE = "America/Denver" as const;

const toRecord = <T extends string>(dates: readonly string[], value: T): Record<string, T> =>
  Object.fromEntries(dates.map((date) => [date, value])) as Record<string, T>;

// -----------------------------------------------------------------------------
// Windsor Charter Academy — 2026-2027 Navy/Green Calendar
// UI terminology requested by the user:
//   source "Navy" -> "blue"
//   source "Green" -> "green"
// -----------------------------------------------------------------------------

export const WCA_BLUE_DATES = [
  // August 2026
  "2026-08-13", "2026-08-17", "2026-08-19", "2026-08-21",
  "2026-08-25", "2026-08-27", "2026-08-31",

  // September 2026
  "2026-09-02", "2026-09-04", "2026-09-09", "2026-09-11",
  "2026-09-15", "2026-09-17", "2026-09-21", "2026-09-23",
  "2026-09-29",

  // October 2026
  "2026-10-01", "2026-10-05", "2026-10-07", "2026-10-13",
  "2026-10-15", "2026-10-19", "2026-10-21", "2026-10-23",
  "2026-10-27", "2026-10-29",

  // November 2026
  "2026-11-02", "2026-11-04", "2026-11-06", "2026-11-10",
  "2026-11-12", "2026-11-16", "2026-11-18", "2026-11-20",

  // December 2026
  "2026-12-01", "2026-12-03", "2026-12-07", "2026-12-09",
  "2026-12-11", "2026-12-15", "2026-12-17",

  // January 2027
  "2027-01-06", "2027-01-08", "2027-01-12", "2027-01-14",
  "2027-01-19", "2027-01-21", "2027-01-25", "2027-01-27",
  "2027-01-29",

  // February 2027
  "2027-02-02", "2027-02-04", "2027-02-08", "2027-02-10",
  "2027-02-16", "2027-02-18", "2027-02-22", "2027-02-24",
  "2027-02-26",

  // March 2027
  "2027-03-02", "2027-03-04", "2027-03-08", "2027-03-10",
  "2027-03-15", "2027-03-17", "2027-03-19", "2027-03-30",

  // April 2027
  "2027-04-01", "2027-04-05", "2027-04-07", "2027-04-09",
  "2027-04-13", "2027-04-15", "2027-04-19", "2027-04-21",
  "2027-04-23", "2027-04-28", "2027-04-30",

  // May 2027
  "2027-05-04", "2027-05-06", "2027-05-10", "2027-05-12",
  "2027-05-14", "2027-05-18", "2027-05-20",
] as const;

export const WCA_GREEN_DATES = [
  // August 2026
  "2026-08-14", "2026-08-18", "2026-08-20", "2026-08-24",
  "2026-08-26", "2026-08-28",

  // September 2026
  "2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10",
  "2026-09-14", "2026-09-16", "2026-09-18", "2026-09-22",
  "2026-09-24", "2026-09-28", "2026-09-30",

  // October 2026
  "2026-10-02", "2026-10-06", "2026-10-08", "2026-10-14",
  "2026-10-16", "2026-10-20", "2026-10-22", "2026-10-26",
  "2026-10-28", "2026-10-30",

  // November 2026
  "2026-11-03", "2026-11-05", "2026-11-09", "2026-11-11",
  "2026-11-13", "2026-11-17", "2026-11-19", "2026-11-30",

  // December 2026
  "2026-12-02", "2026-12-04", "2026-12-08", "2026-12-10",
  "2026-12-14", "2026-12-16",

  // January 2027
  "2027-01-05", "2027-01-07", "2027-01-11", "2027-01-13",
  "2027-01-15", "2027-01-20", "2027-01-22", "2027-01-26",
  "2027-01-28",

  // February 2027
  "2027-02-01", "2027-02-03", "2027-02-05", "2027-02-09",
  "2027-02-11", "2027-02-17", "2027-02-19", "2027-02-23",
  "2027-02-25",

  // March 2027
  "2027-03-01", "2027-03-03", "2027-03-05", "2027-03-09",
  "2027-03-11", "2027-03-16", "2027-03-18", "2027-03-29",
  "2027-03-31",

  // April 2027
  "2027-04-02", "2027-04-06", "2027-04-08", "2027-04-12",
  "2027-04-14", "2027-04-16", "2027-04-20", "2027-04-22",
  "2027-04-27", "2027-04-29",

  // May 2027
  "2027-05-03", "2027-05-05", "2027-05-07", "2027-05-11",
  "2027-05-13", "2027-05-17", "2027-05-19",
] as const;

// Explicit no-school dates identified by the WCA calendar notes / special colors.
// Special first-day dates that are not Navy/Green are intentionally NOT forced into
// blue/green. The helper therefore returns null for those if they are not listed here.
export const WCA_NO_SCHOOL_DATES = [
  "2026-09-07",
  "2026-10-09",
  "2026-10-12",
  "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27",
  "2026-12-18",
  "2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25",
  "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
  "2027-01-01", "2027-01-04", "2027-01-18",
  "2027-02-12", "2027-02-15",
  "2027-03-12",
  "2027-03-22", "2027-03-23", "2027-03-24", "2027-03-25", "2027-03-26",
  "2027-04-26",
  "2027-05-21",
] as const;

export const WCA_CALENDAR: Record<string, WcaDayType> = {
  ...toRecord(WCA_BLUE_DATES, "blue"),
  ...toRecord(WCA_GREEN_DATES, "green"),
  ...toRecord(WCA_NO_SCHOOL_DATES, "no-school"),
};

// -----------------------------------------------------------------------------
// Windsor High School — 2026-2027 Maroon & Gold Rotation
// Only cells visibly colored maroon/pink or gold/yellow are mapped.
// Purple, green, red, white, and "T" dates are intentionally left unmapped.
// -----------------------------------------------------------------------------

export const WHS_MAROON_DATES = [
  // August 2026
  "2026-08-13", "2026-08-17", "2026-08-19", "2026-08-21",
  "2026-08-25", "2026-08-27", "2026-08-31",

  // September 2026
  "2026-09-02", "2026-09-04", "2026-09-09", "2026-09-11",
  "2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24",
  "2026-09-28", "2026-09-30",

  // October 2026
  "2026-10-02", "2026-10-06", "2026-10-08", "2026-10-12",
  "2026-10-14", "2026-10-20", "2026-10-22", "2026-10-26",
  "2026-10-28", "2026-10-30",

  // November 2026
  "2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12",
  "2026-11-16", "2026-11-18", "2026-11-20",

  // December 2026
  "2026-12-01", "2026-12-03", "2026-12-07", "2026-12-09",
  "2026-12-11",

  // January 2027
  "2027-01-07", "2027-01-11", "2027-01-13", "2027-01-15",
  "2027-01-20", "2027-01-22", "2027-01-26", "2027-01-28",

  // February 2027
  "2027-02-01", "2027-02-03", "2027-02-05", "2027-02-09",
  "2027-02-11", "2027-02-17", "2027-02-19", "2027-02-23",
  "2027-02-25",

  // March 2027
  "2027-03-01", "2027-03-03", "2027-03-05", "2027-03-09",
  "2027-03-11", "2027-03-23", "2027-03-25", "2027-03-29",
  "2027-03-31",

  // April 2027
  "2027-04-05", "2027-04-07", "2027-04-09", "2027-04-13",
  "2027-04-15", "2027-04-19", "2027-04-21", "2027-04-26",
  "2027-04-28", "2027-04-30",

  // May 2027
  "2027-05-04", "2027-05-06", "2027-05-10", "2027-05-12",
  "2027-05-14", "2027-05-18", "2027-05-20",
] as const;

export const WHS_GOLD_DATES = [
  // August 2026
  "2026-08-14", "2026-08-18", "2026-08-20", "2026-08-24",
  "2026-08-26", "2026-08-28",

  // September 2026
  "2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10",
  "2026-09-14", "2026-09-16", "2026-09-21", "2026-09-23",
  "2026-09-25", "2026-09-29",

  // October 2026
  "2026-10-01", "2026-10-05", "2026-10-07", "2026-10-09",
  "2026-10-13", "2026-10-15", "2026-10-21", "2026-10-23",
  "2026-10-27", "2026-10-29",

  // November 2026
  "2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11",
  "2026-11-13", "2026-11-17", "2026-11-19", "2026-11-30",

  // December 2026
  "2026-12-02", "2026-12-04", "2026-12-08", "2026-12-10",
  "2026-12-14",

  // January 2027
  "2027-01-08", "2027-01-12", "2027-01-14", "2027-01-19",
  "2027-01-21", "2027-01-25", "2027-01-27", "2027-01-29",

  // February 2027
  "2027-02-02", "2027-02-04", "2027-02-08", "2027-02-10",
  "2027-02-16", "2027-02-18", "2027-02-22", "2027-02-24",
  "2027-02-26",

  // March 2027
  "2027-03-02", "2027-03-04", "2027-03-08", "2027-03-10",
  "2027-03-22", "2027-03-24", "2027-03-26", "2027-03-30",

  // April 2027
  "2027-04-01", "2027-04-06", "2027-04-08", "2027-04-12",
  "2027-04-14", "2027-04-16", "2027-04-20", "2027-04-22",
  "2027-04-27", "2027-04-29",

  // May 2027
  "2027-05-03", "2027-05-05", "2027-05-07", "2027-05-11",
  "2027-05-13", "2027-05-17", "2027-05-19", "2027-05-21",
] as const;

export const WHS_CALENDAR: Record<string, WhsDayType> = {
  ...toRecord(WHS_MAROON_DATES, "maroon"),
  ...toRecord(WHS_GOLD_DATES, "gold"),
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Format any Date as an ISO YYYY-MM-DD date key in Windsor, Colorado local time.
 * This avoids UTC rollover showing tomorrow's rotation too early.
 */
export function getDenverDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format America/Denver calendar date.");
  }

  return `${year}-${month}-${day}`;
}

function normalizeDateKey(date: Date | string): string {
  if (typeof date === "string") return date;
  return getDenverDateKey(date);
}

export function getWcaDayType(date: Date | string = new Date()): WcaDayType | null {
  return WCA_CALENDAR[normalizeDateKey(date)] ?? null;
}

export function getWhsDayType(date: Date | string = new Date()): WhsDayType | null {
  return WHS_CALENDAR[normalizeDateKey(date)] ?? null;
}

export function getSchoolDayStatuses(date: Date | string = new Date()) {
  const dateKey = normalizeDateKey(date);

  return {
    dateKey,
    wca: getWcaDayType(dateKey),
    whs: getWhsDayType(dateKey),
  } as const;
}
