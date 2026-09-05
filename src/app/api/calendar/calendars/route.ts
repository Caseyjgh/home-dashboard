import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { auth } from "@/auth";
import { getCalendarChoices, getSelectedCalendarIds, saveCalendarChoices, saveSelectedCalendarIds, saveCalendarTimeZone } from "@/lib/calendar-cache";
import { fetchCalendarChoices, GoogleCalendarError, usableAccessToken } from "@/lib/google-calendar";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function calendarListError(error: unknown) {
  if (error instanceof GoogleCalendarError) {
    if (error.status === 401) return { status: 401, message: "Google Calendar authorization expired. Please reconnect Google Calendar.", reconnect: true };
    if (error.status === 403 && ["insufficientPermissions", "insufficient_scope", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"].includes(error.reason ?? "")) {
      return { status: 403, message: "Google Calendar read access was not granted. Please reconnect Google Calendar.", reconnect: true };
    }
    if (error.status === 403 && ["accessNotConfigured", "SERVICE_DISABLED"].includes(error.reason ?? "")) {
      return { status: 403, message: "Google Calendar API is not enabled for this Google Cloud project." };
    }
    return { status: error.status === 429 ? 429 : 502, message: "Google Calendar could not load your calendar list." };
  }
  return { status: 500, message: "Calendar choices could not be loaded." };
}

export async function GET(request: NextRequest) {
  let tokenState: { hasAccessToken: boolean; hasRefreshToken: boolean; hasCalendarScope: boolean | null } | undefined;
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return Response.json({ error: "Not authenticated. Please connect Google Calendar." }, { status: 401 });
    let calendars = await getCalendarChoices(email);
    let selectedIds = await getSelectedCalendarIds(email);
    if (!calendars) {
      const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" });
      tokenState = {
        hasAccessToken: Boolean(token?.accessToken),
        hasRefreshToken: Boolean(token?.refreshToken),
        hasCalendarScope: token?.oauthScope ? token.oauthScope.split(" ").includes(CALENDAR_SCOPE) : null,
      };
      if (!token || (!token.accessToken && !token.refreshToken)) {
        return Response.json({ error: "Google Calendar authorization is missing. Please reconnect Google Calendar.", reconnect: true }, { status: 401 });
      }
      if (tokenState.hasCalendarScope === false) {
        return Response.json({ error: "Google Calendar read access was not granted. Please reconnect Google Calendar.", reconnect: true }, { status: 403 });
      }
      calendars = await fetchCalendarChoices(await usableAccessToken(token));
      selectedIds = calendars.filter((calendar) => calendar.selected || calendar.primary).map((calendar) => calendar.id);
      await Promise.all([saveCalendarChoices(email, calendars), saveSelectedCalendarIds(email, selectedIds)]);
    }
    const selected = new Set(selectedIds);
    return Response.json({ calendars: calendars.map((calendar) => ({ ...calendar, selected: selected.has(calendar.id) })) });
  } catch (error) {
    const failure = calendarListError(error);
    console.error("calendar_list_failed", {
      status: error instanceof GoogleCalendarError ? error.status : 500,
      googleReason: error instanceof GoogleCalendarError ? error.reason : undefined,
      ...tokenState,
    });
    return Response.json({ error: failure.message, reconnect: "reconnect" in failure && failure.reconnect === true }, { status: failure.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return Response.json({ error: "Not authenticated. Please connect Google Calendar." }, { status: 401 });
    const body = await request.json().catch(() => null) as { selectedIds?: unknown; timeZone?: unknown } | null;
    if (!body) return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (!Array.isArray(body.selectedIds) || !body.selectedIds.every((id) => typeof id === "string")) return Response.json({ error: "Invalid calendar selection" }, { status: 400 });
    const calendars = await getCalendarChoices(email);
    if (!calendars) return Response.json({ error: "Load calendars before saving a selection." }, { status: 409 });
    const allowed = new Set(calendars.map((calendar) => calendar.id));
    const selectedIds = [...new Set(body.selectedIds)].filter((id) => allowed.has(id));
    if (selectedIds.length === 0) return Response.json({ error: "Select at least one calendar." }, { status: 400 });
    if (typeof body.timeZone === "string") {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: body.timeZone }).format();
        await saveCalendarTimeZone(email, body.timeZone);
      } catch {
        return Response.json({ error: "Invalid timezone." }, { status: 400 });
      }
    }
    await saveSelectedCalendarIds(email, selectedIds);
    return Response.json({ selectedIds });
  } catch (error) {
    console.error("calendar_selection_save_failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Calendar selection could not be saved." }, { status: 500 });
  }
}
