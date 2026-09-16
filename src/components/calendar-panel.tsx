"use client";

import Link from "next/link";
import { calendarEventTime as eventTime, upcomingCalendarDays } from "@/lib/calendar-display";
import { FitList } from "./fit-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { useCachedCalendar } from "@/hooks/use-cached-calendar";
import { requestJson } from "@/lib/client-request";
import type { CalendarCache, CalendarChoice, CalendarEvent } from "@/lib/calendar-types";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function moveDate(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return localDateKey(new Date(year, month - 1, day + days, 12));
}

function displayDate(dateKey: string) {
  if (!dateKey) return "Today";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}


type ApiData = { error?: string; reconnect?: boolean };
function apiError(response: Response, data: ApiData, fallback: string) {
  return {
    message: typeof data.error === "string" && data.error ? data.error : `${fallback} (${response.status})`,
    reconnect: data.reconnect === true,
  };
}

export function CalendarPanel({ settingsOnly = false, mobile = false }: { settingsOnly?: boolean; mobile?: boolean }) {
  const now = useMinuteClock();
  const { calendar, setCalendar, connection, reloadCache } = useCachedCalendar();
  const [selectedDate, setSelectedDate] = useState("");
  const [refreshingCalendar, setRefreshingCalendar] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);
  const [calendarReconnectRequired, setCalendarReconnectRequired] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [calendarChoices, setCalendarChoices] = useState<CalendarChoice[] | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const reconnectCompletionStarted = useRef(false);
  const requests = useRef<AbortController | null>(null);
  const previousDay = useRef("");
  const settingsOpened = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    requests.current = controller;
    return () => controller.abort();
  }, []);

  const request = useCallback(async <T,>(url: string, options: RequestInit = {}) => {
    return requestJson<T>(url, { ...options, signal: requests.current?.signal });
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setSelectedDate(localDateKey(new Date()));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, []);

  useEffect(() => {
    if (calendar.loading || !calendar.authenticated || reconnectCompletionStarted.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("calendarReconnect") !== "complete") return;
    const controller = new AbortController();
    const completion = window.setTimeout(() => {
      reconnectCompletionStarted.current = true;
      setLoadingCalendars(true);
      setRefreshingCalendar(true);
      setCalendarNotice("Finishing Google Calendar reconnection…");
      void requestJson<ApiData & { calendars: CalendarChoice[]; selectedIds: string[]; cache: CalendarCache }>(
        "/api/calendar/reconnect", { method: "POST", signal: controller.signal },
      ).then(({ response, data }) => {
        if (!response.ok) {
          const failure = apiError(response, data, "Unable to finish reconnecting Google Calendar");
          if (!controller.signal.aborted) setCalendarReconnectRequired(failure.reconnect);
          throw new Error(failure.message);
        }
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setCalendarChoices(data.calendars);
        setCalendar((current) => ({ ...current, cache: data.cache, selectedIds: data.selectedIds, calendarAccess: true }));
        setCalendarReconnectRequired(false);
        setCalendarNotice("Google Calendar reconnected and refreshed.");
        window.history.replaceState({}, "", url.pathname);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCalendarNotice(error instanceof Error ? error.message : "Unable to finish reconnecting Google Calendar.");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoadingCalendars(false);
        setRefreshingCalendar(false);
      });
    }, 0);
    return () => { window.clearTimeout(completion); controller.abort(); };
  }, [calendar.authenticated, calendar.loading, setCalendar]);

  const calendarTimeZone = calendar.cache?.timeZone || calendar.timeZone || "America/Denver";
  const dayEvents = useMemo(() => {
    const selectedCalendarSet = new Set(calendarChoices
      ? calendarChoices.filter((choice) => choice.selected).map((choice) => choice.id)
      : calendar.selectedIds);
    return (calendar.cache?.events ?? [])
      .filter((event) => event.days.includes(selectedDate) && selectedCalendarSet.has(event.calendarId))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  }, [calendar.cache, calendar.selectedIds, calendarChoices, selectedDate]);
  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);
  const todayKey = now ? localDateKey(now) : "";
  useEffect(() => {
    if (!todayKey) return;
    const oldDay = previousDay.current;
    previousDay.current = todayKey;
    if (!oldDay || oldDay === todayKey) return;
    const timer = window.setTimeout(() => {
      setSelectedDate((current) => current === oldDay ? todayKey : current);
      reloadCache();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [todayKey, reloadCache]);
  const upcoming = mobile && selectedDate ? upcomingCalendarDays(calendar.cache?.events ?? [], calendar.selectedIds, selectedDate) : [];
  const dateIsCached = Boolean(
    calendar.cache && selectedDate >= calendar.cache.rangeStart && selectedDate < calendar.cache.rangeEnd,
  );

  async function refreshCalendar() {
    if (refreshingCalendar) return;
    const nowMs = Date.now();
    if (cooldownUntil > nowMs) {
      const minutes = Math.max(1, Math.ceil((cooldownUntil - nowMs) / 60_000));
      setCalendarNotice(`Calendar was refreshed recently. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      return;
    }
    setRefreshingCalendar(true);
    setCalendarNotice(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver";
      const { response, data } = await request<{ cache?: CalendarCache | null; error?: string; retryAfter?: number; reconnect?: boolean }>("/api/calendar/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone }),
      });
      if (data.cache) setCalendar((current) => ({ ...current, cache: data.cache ?? null }));
      setCalendarReconnectRequired(data.reconnect === true);
      if (response.status === 429) {
        const secondsLeft = data.retryAfter ?? 300;
        setCooldownUntil(Date.now() + secondsLeft * 1000);
        const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
        setCalendarNotice(`Calendar was refreshed recently. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      } else if (!response.ok) {
        setCalendarNotice(data.error || "Calendar couldn't be refreshed. Showing previously saved events.");
      } else {
        setCooldownUntil(Date.now() + 5 * 60_000);
      }
    } catch {
      setCalendarNotice("Calendar couldn't be refreshed. Showing previously saved events.");
    } finally {
      setRefreshingCalendar(false);
    }
  }

  const openCalendarSettings = useCallback(async () => {
    setShowCalendarSettings(true);
    if (calendarChoices || loadingCalendars) return;
    setLoadingCalendars(true);
    setCalendarNotice(null);
    try {
      const { response, data } = await request<ApiData & { calendars?: CalendarChoice[] }>("/api/calendar/calendars");
      if (!response.ok) {
        const failure = apiError(response, data, "Unable to load calendars");
        setCalendarReconnectRequired(failure.reconnect);
        throw new Error(failure.message);
      }
      if (!data.calendars) throw new Error("The calendar service returned an invalid response.");
      setCalendarReconnectRequired(false);
      setCalendarChoices(data.calendars);
    } catch (error) {
      setCalendarNotice(error instanceof Error ? error.message : "Unable to load calendars.");
    } finally {
      setLoadingCalendars(false);
    }
  }, [calendarChoices, loadingCalendars, request]);

  useEffect(() => {
    if (!settingsOnly || !calendar.authenticated || settingsOpened.current) return;
    const timer = window.setTimeout(() => {
      settingsOpened.current = true;
      void openCalendarSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [settingsOnly, calendar.authenticated, openCalendarSettings]);

  async function saveCalendarSelection() {
    if (!calendarChoices || savingCalendars) return;
    setSavingCalendars(true);
    setCalendarNotice(null);
    try {
      const { response, data } = await request<ApiData>("/api/calendar/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedIds: calendarChoices.filter((calendar) => calendar.selected).map((calendar) => calendar.id),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver",
        }),
      });
      if (!response.ok) throw new Error(apiError(response, data, "Unable to save calendars").message);
      const selectedIds = calendarChoices.filter((choice) => choice.selected).map((choice) => choice.id);
      setCalendar((current) => ({ ...current, selectedIds }));
      setShowCalendarSettings(false);
      setCalendarNotice("Calendar selection saved. Refresh Calendar to update saved events.");
    } catch (error) {
      setCalendarNotice(error instanceof Error ? error.message : "Unable to save calendars.");
    } finally {
      setSavingCalendars(false);
    }
  }

  async function connectGoogleCalendar() {
    try {
      const { signIn } = await import("next-auth/react");
      await signIn("google", { redirectTo: mobile ? "/mobile/calendar" : "/" });
    } catch { setCalendarNotice("Sign-in could not start. Check your connection and try again."); }
  }

  async function reconnectGoogleCalendar() {
    setCalendarNotice("Starting a fresh Google Calendar connection…");
    try {
      const { response, data } = await request<ApiData>("/api/calendar/disconnect", { method: "POST" });
      if (!response.ok) throw new Error(apiError(response, data, "Unable to reset Google Calendar").message);
      const { signIn, signOut } = await import("next-auth/react");
      await signOut({ redirect: false });
      await signIn("google", { redirectTo: mobile ? "/mobile/calendar?calendarReconnect=complete" : "/?calendarReconnect=complete" }, {
        scope: `openid email profile ${CALENDAR_SCOPE}`,
        access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true",
      });
    } catch { setCalendarNotice("Reconnection could not finish. Check your connection and try again."); }
  }

  const renderEvent = (event: CalendarEvent) => <><time>{eventTime(event, calendarTimeZone)}</time><div><strong title={event.title}>{event.title}</strong><span>{event.calendarName}{event.location ? ` · ${event.location}` : ""}</span></div></>;

  return (
        <section className="calendar-panel" aria-labelledby="calendar-heading">
          <div className="section-heading calendar-heading">
            <div>

              <h2 id="calendar-heading" className={settingsOnly ? "" : "sr-only"}>{settingsOnly ? "Calendar settings" : selectedDate === todayKey ? "Today" : displayDate(selectedDate)}</h2>
            </div>
            {calendar.authenticated && (
              <div className="calendar-actions">
                {settingsOnly || mobile ? <button onClick={openCalendarSettings}>Calendars</button> : <Link href="/calendar-settings" prefetch={false}>Calendars</Link>}
                <button className="refresh-button" onClick={refreshCalendar} disabled={refreshingCalendar}>
                  {refreshingCalendar ? "Refreshing…" : "Refresh Calendar"}
                </button>
              </div>
            )}
          </div>
          <div className="date-navigation">
            <button onClick={() => setSelectedDate((date) => moveDate(date, -1))} disabled={!selectedDate} aria-label="Previous day">←</button>
            <button aria-label="Today" onClick={() => setSelectedDate(localDateKey(new Date()))}>{selectedDate === todayKey ? "Today" : displayDate(selectedDate)}</button>
            <button onClick={() => setSelectedDate((date) => moveDate(date, 1))} disabled={!selectedDate} aria-label="Next day">→</button>
          </div>
          {settingsOnly && calendar.cache && (
            <p className="last-refreshed">Last refreshed: {new Date(calendar.cache.refreshedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: calendarTimeZone })} at {new Date(calendar.cache.refreshedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: calendarTimeZone })}</p>
          )}
          {(connection === "offline" || connection === "error") && (
            <div className="calendar-warning" role="status">
              <span>{connection === "offline" ? "Offline." : "Calendar connection unavailable."} Showing saved content where available. Reconnecting automatically.</span>
              <button type="button" onClick={reloadCache}>Retry connection</button>
            </div>
          )}
          {calendarNotice && (
            <div className="calendar-warning" role="status">
              <span>{calendarNotice}</span>
              {(calendarReconnectRequired || calendar.calendarAccess === false) && (
                <button type="button" onClick={reconnectGoogleCalendar}>Reconnect Google Calendar</button>
              )}
            </div>
          )}
          {!calendarNotice && calendar.calendarAccess === false && (
            <div className="calendar-warning" role="status">
              <span>Google Calendar read access was not granted.</span>
              <button type="button" onClick={reconnectGoogleCalendar}>Reconnect Google Calendar</button>
            </div>
          )}
          {calendar.loading ? (
            <p className="calendar-message">Loading your calendar…</p>
          ) : !calendar.configured ? (
            <div className="calendar-connect">
              <div>
                <strong>Calendar setup is almost ready.</strong>
                <p>Missing environment {calendar.missingVariables.length === 1 ? "variable" : "variables"}: {calendar.missingVariables.join(", ") || "configuration could not be loaded"}.</p>
              </div>
            </div>
          ) : !calendar.authenticated ? (
            <div className="calendar-connect">
              <div>
                <strong>Bring today into view.</strong>
                <p>Connect Google Calendar with read-only access to see events and times here.</p>
              </div>
              <button type="button" onClick={connectGoogleCalendar}>
                Connect Google Calendar
              </button>
            </div>
          ) : showCalendarSettings ? (
            <div className="calendar-settings">
              <div className="settings-title"><strong>Choose calendars</strong><button onClick={() => setShowCalendarSettings(false)} aria-label="Close calendar settings">×</button></div>
              {loadingCalendars ? <p>Loading your Google calendars…</p> : calendarChoices ? (
                <>
                  <div className="calendar-options">
                    {calendarChoices.map((choice) => (
                      <label key={choice.id}>
                        <input type="checkbox" checked={choice.selected} onChange={() => setCalendarChoices((current) => current?.map((item) => item.id === choice.id ? { ...item, selected: !item.selected } : item) ?? null)} />
                        <span className="calendar-dot" style={{ backgroundColor: choice.color || "#d7b979" }} />
                        <span>{choice.name}{choice.primary ? " (Primary)" : ""}</span>
                      </label>
                    ))}
                  </div>
                  <button className="save-calendars" onClick={saveCalendarSelection} disabled={savingCalendars}>{savingCalendars ? "Saving…" : "Save calendars"}</button>
                </>
              ) : <p>Calendar choices could not be loaded.</p>}
            </div>
          ) : !calendar.cache ? (
            <div className="calendar-connect">
              <div><strong>No saved calendar data yet.</strong><p>Choose the calendars you want, then click Refresh Calendar to retrieve the 30-day past and 90-day future range.</p></div>
              <button onClick={openCalendarSettings}>Choose calendars</button>
            </div>
          ) : !dateIsCached ? (
            <p className="calendar-message">This date is outside the saved calendar range.</p>
          ) : dayEvents.length === 0 ? (
            <p className="calendar-message">No events scheduled for this day.</p>
          ) : mobile ? (
            <ol className="mobile-calendar-events">{[...allDayEvents, ...timedEvents].map(event => <li key={`${event.calendarId}:${event.id}`}>{renderEvent(event)}</li>)}</ol>
          ) : (
            <FitList key={selectedDate} items={[...allDayEvents, ...timedEvents]} label="calendar events" className="calendar-events" renderItem={(event) => <li key={event.id}><time>{eventTime(event, calendarTimeZone)}</time><div><strong title={event.title}>{event.title}</strong><span>{event.calendarName}{event.location ? ` · ${event.location}` : ""}</span></div></li>} />
          )}
          {mobile && calendar.authenticated && !showCalendarSettings && calendar.cache && <section className="mobile-upcoming" aria-label="Upcoming events"><h2>Upcoming</h2>
            {upcoming.length ? upcoming.map(group => <section key={group.date}><h3>{displayDate(group.date)}</h3><ol className="mobile-calendar-events">{group.events.map(event => <li key={`${event.calendarId}:${event.id}`}>{renderEvent(event)}</li>)}</ol></section>) : <p>No upcoming events in the saved calendar.</p>}
          </section>}
        </section>

  );
}
