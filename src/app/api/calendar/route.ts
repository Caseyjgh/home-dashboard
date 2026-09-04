import { auth } from "@/auth";
import { calendarCacheConfigured, getCalendarCache, getCalendarTimeZone, getSelectedCalendarIds } from "@/lib/calendar-cache";

export async function GET() {
  const configured = Boolean(process.env.AUTH_SECRET && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && calendarCacheConfigured());
  if (!configured) return Response.json({ configured: false, authenticated: false, cache: null, selectedIds: [] });
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ configured: true, authenticated: false, cache: null, selectedIds: [] });
  const [cache, timeZone, selectedIds] = await Promise.all([getCalendarCache(email), getCalendarTimeZone(email), getSelectedCalendarIds(email)]);
  return Response.json({ configured: true, authenticated: true, cache, timeZone, selectedIds });
}
