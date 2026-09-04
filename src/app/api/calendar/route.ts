import { auth } from "@/auth";

export async function GET() {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return Response.json({ configured: false, authenticated: false, events: [] });
  }
  const session = await auth();
  if (!session?.user) {
    return Response.json({ configured: true, authenticated: false, events: [] });
  }
  return Response.json({
    configured: true,
    authenticated: true,
    events: session.calendarEvents,
    error: session.calendarError,
  });
}
