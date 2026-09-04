import type { JWT } from "@auth/core/jwt";
import type { CalendarChoice, CalendarEvent } from "./calendar-types";

type GoogleCalendar = { id?: string; summary?: string; primary?: boolean; backgroundColor?: string; selected?: boolean };
type GoogleEvent = {
  id?: string;
  summary?: string;
  location?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};
type GooglePage<T> = { items?: T[]; nextPageToken?: string };

export class GoogleCalendarError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function timeZoneOffset(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "+" ? 1 : -1) * minutes;
}

function zonedMidnight(year: number, month: number, day: number, timeZone: string) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  return new Date(guess.getTime() - timeZoneOffset(guess, timeZone) * 60_000);
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dateKey(date: Date, timeZone: string) {
  const { year, month, day } = dateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDateDays(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function refreshRange(timeZone: string) {
  const today = dateKey(new Date(), timeZone);
  const startKey = addDateDays(today, -30);
  const endKey = addDateDays(today, 91);
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  return {
    rangeStart: startKey,
    rangeEnd: endKey,
    timeMin: zonedMidnight(sy, sm, sd, timeZone).toISOString(),
    timeMax: zonedMidnight(ey, em, ed, timeZone).toISOString(),
  };
}

function eventDays(start: string, end: string, allDay: boolean, timeZone: string) {
  const first = allDay ? start : dateKey(new Date(start), timeZone);
  const last = allDay ? addDateDays(end, -1) : dateKey(new Date(new Date(end).getTime() - 1), timeZone);
  const days: string[] = [];
  for (let current = first; current <= last && days.length < 370; current = addDateDays(current, 1)) days.push(current);
  return days;
}

async function googleFetch<T>(url: string, accessToken: string): Promise<T> {
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.ok) return response.json() as Promise<T>;
    const retryable = response.status === 403 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) throw new GoogleCalendarError(response.status, `Google Calendar returned ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new GoogleCalendarError(500, "Google Calendar retry limit reached");
}

export async function usableAccessToken(token: JWT) {
  if (token.accessToken && token.expiresAt && Date.now() < token.expiresAt * 1000 - 30_000) return token.accessToken;
  if (!token.refreshToken) throw new GoogleCalendarError(401, "Google Calendar must be reconnected");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  if (!response.ok) throw new GoogleCalendarError(response.status, "Google authorization could not be refreshed");
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchCalendarChoices(accessToken: string) {
  const calendars: CalendarChoice[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<GooglePage<GoogleCalendar>>(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`, accessToken);
    for (const calendar of page.items ?? []) {
      if (!calendar.id) continue;
      calendars.push({
        id: calendar.id,
        name: calendar.summary || "Unnamed calendar",
        primary: Boolean(calendar.primary),
        selected: calendar.selected !== false,
        color: calendar.backgroundColor,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return calendars;
}

export async function fetchEventsForCalendars(
  accessToken: string,
  calendars: CalendarChoice[],
  timeZone: string,
) {
  const range = refreshRange(timeZone);
  const events: CalendarEvent[] = [];
  for (const calendar of calendars) {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
        timeZone,
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await googleFetch<GooglePage<GoogleEvent>>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`,
        accessToken,
      );
      for (const event of page.items ?? []) {
        if (event.status === "cancelled" || !event.id || !event.start || !event.end) continue;
        const start = event.start.dateTime || event.start.date;
        const end = event.end.dateTime || event.end.date;
        if (!start || !end) continue;
        const allDay = Boolean(event.start.date);
        events.push({
          id: `${calendar.id}:${event.id}`,
          calendarId: calendar.id,
          calendarName: calendar.name,
          title: event.summary || "Untitled event",
          start,
          end,
          allDay,
          days: eventDays(start, end, allDay, timeZone),
          location: event.location,
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  events.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  return { events, ...range };
}
