import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";
import { auth } from "@/auth";
import { getCalendarCache, getCalendarTimeZone, getSelectedCalendarIds } from "@/lib/calendar-cache";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export async function GET(request: NextRequest) {
  const requiredVariables = ["AUTH_SECRET", "CLIENT_ID", "SECRET", "KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);
  if (missingVariables.length > 0) {
    return Response.json({ configured: false, authenticated: false, account: null, calendarAccess: null, cache: null, selectedIds: [], missingVariables });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ configured: true, authenticated: false, account: null, calendarAccess: null, cache: null, selectedIds: [], missingVariables: [] });
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" });
  const calendarAccess = token?.oauthScope ? token.oauthScope.split(" ").includes(CALENDAR_SCOPE) : null;
  const [cache, timeZone, selectedIds] = await Promise.all([getCalendarCache(email), getCalendarTimeZone(email), getSelectedCalendarIds(email)]);
  return Response.json({
    configured: true,
    authenticated: true,
    account: { name: session.user?.name ?? null, email },
    calendarAccess,
    cache,
    timeZone,
    selectedIds,
    missingVariables: [],
  });
}
