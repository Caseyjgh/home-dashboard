import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  location?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

function timeZoneOffset(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "+" ? 1 : -1) * minutes;
}

function zonedMidnight(year: number, month: number, day: number, timeZone: string) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  return new Date(guess.getTime() - timeZoneOffset(guess, timeZone) * 60_000);
}

function todayBounds(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return {
    start: zonedMidnight(year, month, day, timeZone),
    end: zonedMidnight(year, month, day + 1, timeZone),
  };
}

async function getTodaysEvents(accessToken: string) {
  const timeZone = process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/Denver";
  const { start, end } = todayBounds(timeZone);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "30",
    timeZone,
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Google Calendar returned ${response.status}`);
  const data = (await response.json()) as { items?: GoogleEvent[] };
  return (data.items ?? [])
    .filter((event) => event.status !== "cancelled" && event.id && event.start && event.end)
    .map((event): CalendarEvent => ({
      id: event.id!,
      title: event.summary || "Untitled event",
      start: event.start!.dateTime || event.start!.date!,
      end: event.end!.dateTime || event.end!.date!,
      allDay: Boolean(event.start!.date),
      location: event.location,
    }));
}

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
        token.refreshToken = account.refresh_token;
        return token;
      }
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) return token;
      if (!token.refreshToken) return { ...token, error: "RefreshTokenError" as const };

      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        });
        if (!response.ok) throw new Error(`Token refresh returned ${response.status}`);
        const refreshed = (await response.json()) as {
          access_token: string;
          expires_in: number;
          refresh_token?: string;
        };
        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Math.floor(Date.now() / 1000 + refreshed.expires_in),
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
          error: undefined,
        };
      } catch (error) {
        console.error("Unable to refresh Google access token", error);
        return { ...token, error: "RefreshTokenError" as const };
      }
    },
    async session({ session, token }) {
      session.calendarEvents = [];
      if (token.error) {
        session.calendarError = token.error;
        return session;
      }
      if (!token.accessToken) return session;
      try {
        session.calendarEvents = await getTodaysEvents(token.accessToken);
      } catch (error) {
        console.error("Unable to load Google Calendar", error);
        session.calendarError = "CalendarFetchError";
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    calendarEvents: CalendarEvent[];
    calendarError?: "RefreshTokenError" | "CalendarFetchError";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    expiresAt?: number;
    refreshToken?: string;
    error?: "RefreshTokenError";
  }
}
