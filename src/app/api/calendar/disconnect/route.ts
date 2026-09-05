import { auth } from "@/auth";
import { clearCalendarData } from "@/lib/calendar-cache";

export async function POST() {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return Response.json({ disconnected: true });

    await clearCalendarData(email);
    console.info("calendar_disconnected", { timestamp: new Date().toISOString(), success: true });
    return Response.json({ disconnected: true });
  } catch (error) {
    console.error("calendar_disconnected", {
      timestamp: new Date().toISOString(),
      success: false,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "Calendar data could not be reset." }, { status: 500 });
  }
}
