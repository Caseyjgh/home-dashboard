import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { auth } from "@/auth";
import {
  getCalendarTimeZone,
  getSelectedCalendarIds,
  saveCalendarCache,
  saveCalendarChoices,
  saveSelectedCalendarIds,
} from "@/lib/calendar-cache";
import { fetchCalendarChoices, fetchEventsForCalendars, GoogleCalendarError, usableAccessToken } from "@/lib/google-calendar";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return Response.json({ error: "Fresh Google authorization was not completed.", reconnect: true }, { status: 401 });

    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" });
    if (!token || (!token.accessToken && !token.refreshToken)) {
      return Response.json({ error: "Fresh Google authorization did not provide Calendar credentials.", reconnect: true }, { status: 401 });
    }
    if (token.oauthScope && !token.oauthScope.split(" ").includes(CALENDAR_SCOPE)) {
      return Response.json({ error: "Google Calendar read access was not granted.", reconnect: true }, { status: 403 });
    }

    const accessToken = await usableAccessToken(token);
    const calendars = await fetchCalendarChoices(accessToken);
    const previousIds = new Set(await getSelectedCalendarIds(email));
    let selectedIds = calendars.filter((calendar) => previousIds.has(calendar.id)).map((calendar) => calendar.id);
    if (selectedIds.length === 0) {
      selectedIds = calendars.filter((calendar) => calendar.selected || calendar.primary).map((calendar) => calendar.id);
    }
    const selectedSet = new Set(selectedIds);
    const selectedCalendars = calendars.filter((calendar) => selectedSet.has(calendar.id));
    const timeZone = await getCalendarTimeZone(email);
    const result = await fetchEventsForCalendars(accessToken, selectedCalendars, timeZone);
    const cache = {
      events: result.events,
      rangeStart: result.rangeStart,
      rangeEnd: result.rangeEnd,
      timeZone,
      refreshedAt: new Date().toISOString(),
    };

    await Promise.all([
      saveCalendarChoices(email, calendars),
      saveSelectedCalendarIds(email, selectedIds),
      saveCalendarCache(email, cache),
    ]);
    console.info("calendar_reconnect", {
      timestamp,
      calendarsQueried: selectedCalendars.length,
      eventsReturned: result.events.length,
      success: true,
    });
    return Response.json({
      calendars: calendars.map((calendar) => ({ ...calendar, selected: selectedSet.has(calendar.id) })),
      selectedIds,
      cache,
      calendarAccess: true,
    });
  } catch (error) {
    const googleStatus = error instanceof GoogleCalendarError ? error.status : 500;
    const googleReason = error instanceof GoogleCalendarError ? error.reason : undefined;
    const reconnect = googleStatus === 401 || ["authError", "invalid_grant", "insufficientPermissions", "insufficient_scope", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"].includes(googleReason ?? "");
    console.error("calendar_reconnect", { timestamp, calendarsQueried: 0, eventsReturned: 0, success: false, googleStatus, googleReason });
    return Response.json({
      error: reconnect ? "Google Calendar authorization is still unavailable. Please reconnect and approve Calendar read access." : "Google Calendar could not finish reconnecting.",
      reconnect,
    }, { status: reconnect ? 401 : 502 });
  }
}
