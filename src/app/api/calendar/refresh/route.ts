import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { auth } from "@/auth";
import { beginRefresh, getCalendarCache, getCalendarChoices, getSelectedCalendarIds, saveCalendarCache, saveCalendarTimeZone } from "@/lib/calendar-cache";
import { fetchEventsForCalendars, GoogleCalendarError, usableAccessToken } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const choices = await getCalendarChoices(email);
  const selectedIds = new Set(await getSelectedCalendarIds(email));
  const selected = (choices ?? []).filter((calendar) => selectedIds.has(calendar.id));
  if (selected.length === 0) return Response.json({ error: "Select at least one calendar before refreshing." }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { timeZone?: unknown };
  const requestedTimeZone = typeof body.timeZone === "string" ? body.timeZone : "America/Denver";
  let timeZone: string;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: requestedTimeZone }).format();
    timeZone = requestedTimeZone;
  } catch {
    return Response.json({ error: "Invalid timezone." }, { status: 400 });
  }
  const cooldown = await beginRefresh(email);
  if (!cooldown.allowed) {
    return Response.json({ error: "Calendar was refreshed recently.", retryAfter: cooldown.retryAfter }, {
      status: 429,
      headers: { "Retry-After": String(cooldown.retryAfter) },
    });
  }
  const startedAt = new Date().toISOString();
  try {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" });
    if (!token) return Response.json({ error: "Google Calendar must be reconnected." }, { status: 401 });
    const accessToken = await usableAccessToken(token);
    const result = await fetchEventsForCalendars(accessToken, selected, timeZone);
    const cache = { events: result.events, rangeStart: result.rangeStart, rangeEnd: result.rangeEnd, timeZone, refreshedAt: new Date().toISOString() };
    await Promise.all([saveCalendarCache(email, cache), saveCalendarTimeZone(email, timeZone)]);
    console.info("calendar_sync", { timestamp: startedAt, calendarsQueried: selected.length, eventsReturned: result.events.length, success: true });
    return Response.json({ cache });
  } catch (error) {
    const status = error instanceof GoogleCalendarError ? error.status : 500;
    console.error("calendar_sync", { timestamp: startedAt, calendarsQueried: selected.length, eventsReturned: 0, success: false, googleStatus: status });
    return Response.json({ error: "Calendar couldn't be refreshed. Showing previously saved events.", cache: await getCalendarCache(email) }, { status: status === 401 ? 401 : 502 });
  }
}
