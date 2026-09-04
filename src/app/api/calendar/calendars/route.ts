import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { auth } from "@/auth";
import { getCalendarChoices, getSelectedCalendarIds, saveCalendarChoices, saveSelectedCalendarIds, saveCalendarTimeZone } from "@/lib/calendar-cache";
import { fetchCalendarChoices, usableAccessToken } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ error: "Not authenticated" }, { status: 401 });
  let calendars = await getCalendarChoices(email);
  let selectedIds = await getSelectedCalendarIds(email);
  if (!calendars) {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" });
    if (!token) return Response.json({ error: "Google Calendar must be reconnected." }, { status: 401 });
    calendars = await fetchCalendarChoices(await usableAccessToken(token));
    selectedIds = calendars.filter((calendar) => calendar.selected || calendar.primary).map((calendar) => calendar.id);
    await Promise.all([saveCalendarChoices(email, calendars), saveSelectedCalendarIds(email, selectedIds)]);
  }
  const selected = new Set(selectedIds);
  return Response.json({ calendars: calendars.map((calendar) => ({ ...calendar, selected: selected.has(calendar.id) })) });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await request.json()) as { selectedIds?: unknown; timeZone?: unknown };
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
}
