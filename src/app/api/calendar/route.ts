import { auth } from "@/auth";
import { getCalendarCache, getCalendarTimeZone, getSelectedCalendarIds } from "@/lib/calendar-cache";

export async function GET() {
  const requiredVariables = ["AUTH_SECRET", "CLIENT_ID", "SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);
  if (missingVariables.length > 0) {
    return Response.json({ configured: false, authenticated: false, cache: null, selectedIds: [], missingVariables });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ configured: true, authenticated: false, cache: null, selectedIds: [], missingVariables: [] });
  const [cache, timeZone, selectedIds] = await Promise.all([getCalendarCache(email), getCalendarTimeZone(email), getSelectedCalendarIds(email)]);
  return Response.json({ configured: true, authenticated: true, cache, timeZone, selectedIds, missingVariables: [] });
}
