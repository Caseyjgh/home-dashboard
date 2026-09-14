"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { useCachedCalendar } from "@/hooks/use-cached-calendar";
import { requestJson } from "@/lib/client-request";
import { readLocal, validTasks, validRecipes, type Task, type DailyRecipe } from "@/lib/local-data";
import type { CalendarCache, CalendarChoice, CalendarEvent } from "@/lib/calendar-types";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const initialTasks: Task[] = [
  { id: 1, label: "Review today’s calendar", done: true },
  { id: 2, label: "Choose the day’s top priority", done: false },
  { id: 3, label: "Clear the inbox", done: false },
];

const initialRecipes: DailyRecipe[] = [
  { id: "breakfast", label: "Breakfast", recipe: "" },
  { id: "lunch", label: "Lunch", recipe: "" },
  { id: "dinner", label: "Dinner", recipe: "" },
];

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

function eventTime(event: CalendarEvent, timeZone: string) {
  if (event.allDay) return "All day";
  const format = (value: string) => new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return `${format(event.start)} – ${format(event.end)}`;
}

type ApiData = { error?: string; reconnect?: boolean };
function apiError(response: Response, data: ApiData, fallback: string) {
  return {
    message: typeof data.error === "string" && data.error ? data.error : `${fallback} (${response.status})`,
    reconnect: data.reconnect === true,
  };
}

export default function Home() {
  const now = useMinuteClock();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dailyRecipes, setDailyRecipes] = useState<DailyRecipe[]>(initialRecipes);
  const [taskLabel, setTaskLabel] = useState("");
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
  const tasksLoaded = useRef(false);
  const recipesLoaded = useRef(false);
  const reconnectCompletionStarted = useRef(false);
  const requests = useRef<AbortController | null>(null);
  const previousDay = useRef("");
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requests.current = controller;
    return () => controller.abort();
  }, []);

  async function request<T>(url: string, options: RequestInit = {}) {
    return requestJson<T>(url, { ...options, signal: requests.current?.signal });
  }

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setSelectedDate(localDateKey(new Date()));
      try {
        const saved = readLocal("home-dashboard-tasks", validTasks);
        if (saved) setTasks(saved);
        tasksLoaded.current = true;
      } catch { setStorageNotice("Saved tasks could not be read. Changes will not be saved in this session."); }
      try {
        const saved = readLocal("home-dashboard-daily-recipes", validRecipes);
        if (saved) setDailyRecipes(saved);
        recipesLoaded.current = true;
      } catch { setStorageNotice("Saved meals could not be read. Changes will not be saved in this session."); }
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

  useEffect(() => {
    if (!tasksLoaded.current) return;
    try { window.localStorage.setItem("home-dashboard-tasks", JSON.stringify(tasks)); }
    catch { queueMicrotask(() => setStorageNotice("Tasks could not be saved. Browser storage may be full or unavailable.")); }
  }, [tasks]);

  useEffect(() => {
    if (!recipesLoaded.current) return;
    try { window.localStorage.setItem("home-dashboard-daily-recipes", JSON.stringify(dailyRecipes)); }
    catch { queueMicrotask(() => setStorageNotice("Meals could not be saved. Browser storage may be full or unavailable.")); }
  }, [dailyRecipes]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = taskLabel.trim();
    if (!label) return;
    setTasks((current) => [...current, { id: Date.now(), label, done: false }]);
    setTaskLabel("");
  }

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

  async function openCalendarSettings() {
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
  }

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
      await signIn("google", { redirectTo: "/" });
    } catch { setCalendarNotice("Sign-in could not start. Check your connection and try again."); }
  }

  async function reconnectGoogleCalendar() {
    setCalendarNotice("Starting a fresh Google Calendar connection…");
    try {
      const { response, data } = await request<ApiData>("/api/calendar/disconnect", { method: "POST" });
      if (!response.ok) throw new Error(apiError(response, data, "Unable to reset Google Calendar").message);
      const { signIn, signOut } = await import("next-auth/react");
      await signOut({ redirect: false });
      await signIn("google", { redirectTo: "/?calendarReconnect=complete" }, {
        scope: `openid email profile ${CALENDAR_SCOPE}`,
        access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true",
      });
    } catch { setCalendarNotice("Reconnection could not finish. Check your connection and try again."); }
  }

  async function signOutAndResetCalendar() {
    setCalendarNotice("Signing out and resetting Calendar…");
    try {
      const { response, data } = await request<ApiData>("/api/calendar/disconnect", { method: "POST" });
      if (!response.ok) throw new Error(apiError(response, data, "Unable to reset Google Calendar").message);
      const { signOut } = await import("next-auth/react");
      await signOut({ redirectTo: "/" });
    } catch { setCalendarNotice("Sign-out could not finish. Check your connection and try again."); }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Home dashboard"><span className="brand-mark">H</span><span>Home</span></a>
        <p className="date-label">{now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) ?? "Loading today…"}</p>
        <div className="topbar-actions">
          <a className="github-link" href="https://github.com/caseyjgh/home-dashboard">View source <span aria-hidden="true">↗</span></a>
          {calendar.authenticated && calendar.account && (
            <details className="account-menu">
              <summary aria-label="Google account menu">
                <span className="account-avatar" aria-hidden="true">{(calendar.account.name || calendar.account.email).charAt(0).toUpperCase()}</span>
                <span className="account-summary">{calendar.account.name || calendar.account.email}</span>
              </summary>
              <div className="account-popover">
                <strong>{calendar.account.name || "Google account"}</strong>
                <span>{calendar.account.email}</span>
                <button type="button" onClick={reconnectGoogleCalendar}>Reconnect Google Calendar</button>
                <button type="button" onClick={() => void signOutAndResetCalendar()}>Sign out &amp; reset Calendar</button>
              </div>
            </details>
          )}
        </div>
      </header>

      <div className="dashboard" id="top">
        <section className="command-intro">
          <div>
            <p className="eyebrow">Home dashboard</p>
            <h1>Command center</h1>
            <p>Calendar, priorities, and today’s meals in one place.</p>
          </div>
          <div className="clock" aria-label="Current time">{now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) ?? "—:—"}</div>
        </section>

        <section className="calendar-panel" aria-labelledby="calendar-heading">
          <div className="section-heading calendar-heading">
            <div>
              <p className="eyebrow light">Calendar</p>
              <h2 id="calendar-heading">{selectedDate === todayKey ? "Today" : displayDate(selectedDate)}</h2>
            </div>
            {calendar.authenticated && (
              <div className="calendar-actions">
                <button onClick={openCalendarSettings}>Calendars</button>
                <button className="refresh-button" onClick={refreshCalendar} disabled={refreshingCalendar}>
                  {refreshingCalendar ? "Refreshing…" : "Refresh Calendar"}
                </button>
              </div>
            )}
          </div>
          <div className="date-navigation">
            <button onClick={() => setSelectedDate((date) => moveDate(date, -1))} aria-label="Previous day">←</button>
            <button onClick={() => setSelectedDate(localDateKey(new Date()))}>Today</button>
            <button onClick={() => setSelectedDate((date) => moveDate(date, 1))} aria-label="Next day">→</button>
          </div>
          {calendar.cache && (
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
          ) : (
            <div className="event-groups">
              {allDayEvents.length > 0 && <div><p className="event-group-label">All day</p><ol className="event-list all-day-list">{allDayEvents.map((event) => <li key={event.id}><time>All day</time><div><strong>{event.title}</strong><span>{event.calendarName}{event.location ? ` · ${event.location}` : ""}</span></div></li>)}</ol></div>}
              {timedEvents.length > 0 && <div><p className="event-group-label">Schedule</p><ol className="event-list">{timedEvents.map((event) => <li key={event.id}><time>{eventTime(event, calendarTimeZone)}</time><div><strong>{event.title}</strong><span>{event.calendarName}{event.location ? ` · ${event.location}` : ""}</span></div></li>)}</ol></div>}
            </div>
          )}
        </section>

        <div className="content-grid">
          <section className="panel tasks-panel" aria-labelledby="tasks-heading">
            <div className="section-heading compact">
              <div><p className="eyebrow">Today</p><h2 id="tasks-heading">Small wins</h2></div>
              <span className="task-count">{tasks.filter((task) => task.done).length}/{tasks.length}</span>
            </div>
            {storageNotice && <p className="storage-warning" role="status">{storageNotice}</p>}
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id} className={task.done ? "completed" : ""}>
                  <button className="check" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} aria-label={`${task.done ? "Mark incomplete" : "Complete"}: ${task.label}`}>{task.done && "✓"}</button>
                  <span>{task.label}</span>
                  <button className="remove" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} aria-label={`Remove ${task.label}`}>×</button>
                </li>
              ))}
            </ul>
            <form className="task-form" onSubmit={addTask}>
              <input value={taskLabel} onChange={(event) => setTaskLabel(event.target.value)} placeholder="Add something for today" aria-label="New task" />
              <button type="submit">Add</button>
            </form>
          </section>

          <section className="panel recipes-panel" aria-labelledby="recipes-heading">
            <div className="section-heading compact">
              <div><p className="eyebrow light">Today</p><h2 id="recipes-heading">Daily recipes</h2></div>
            </div>
            <div className="recipe-list">
              {dailyRecipes.map((meal) => (
                <label key={meal.id}>
                  <span>{meal.label}</span>
                  <input
                    value={meal.recipe}
                    onChange={(event) => setDailyRecipes((current) => current.map((item) => item.id === meal.id ? { ...item, recipe: event.target.value } : item))}
                    placeholder={`Add a ${meal.label.toLowerCase()} recipe`}
                  />
                </label>
              ))}
            </div>
            <p className="recipe-note">Your meal plan stays private in this browser.</p>
          </section>
        </div>

        <footer><span>Built for calmer days.</span><span>Tasks stay private in this browser.</span></footer>
      </div>
    </main>
  );
}
