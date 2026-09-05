"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import type { CalendarCache, CalendarChoice, CalendarEvent } from "@/lib/calendar-types";

type Task = { id: number; label: string; done: boolean };
type DailyRecipe = { id: "breakfast" | "lunch" | "dinner"; label: string; recipe: string };
type CalendarState = {
  loading: boolean;
  configured: boolean;
  authenticated: boolean;
  cache: CalendarCache | null;
  selectedIds: string[];
  missingVariables: string[];
  timeZone?: string;
  account?: { name: string | null; email: string } | null;
  calendarAccess?: boolean | null;
};

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

async function apiError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: unknown; reconnect?: unknown };
    return {
      message: typeof data.error === "string" && data.error ? data.error : `${fallback} (${response.status})`,
      reconnect: data.reconnect === true,
    };
  } catch {
    return { message: `${fallback} (${response.status})`, reconnect: false };
  }
}

async function apiJson<T>(response: Response, fallback: string) {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(`${fallback}: the server returned an invalid response.`);
  }
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dailyRecipes, setDailyRecipes] = useState<DailyRecipe[]>(initialRecipes);
  const [taskLabel, setTaskLabel] = useState("");
  const [calendar, setCalendar] = useState<CalendarState>({
    loading: true,
    configured: false,
    authenticated: false,
    cache: null,
    selectedIds: [],
    missingVariables: [],
  });
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

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setNow(new Date());
      setSelectedDate(localDateKey(new Date()));
      const saved = window.localStorage.getItem("home-dashboard-tasks");
      if (saved) {
        try { setTasks(JSON.parse(saved) as Task[]); }
        catch { window.localStorage.removeItem("home-dashboard-tasks"); }
      }
      const savedRecipes = window.localStorage.getItem("home-dashboard-daily-recipes");
      if (savedRecipes) {
        try { setDailyRecipes(JSON.parse(savedRecipes) as DailyRecipe[]); }
        catch { window.localStorage.removeItem("home-dashboard-daily-recipes"); }
      }
      tasksLoaded.current = true;
      recipesLoaded.current = true;
    }, 0);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initialize); window.clearInterval(clock); };
  }, []);

  useEffect(() => {
    if (calendar.loading || !calendar.authenticated || reconnectCompletionStarted.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("calendarReconnect") !== "complete") return;
    reconnectCompletionStarted.current = true;
    const completion = window.setTimeout(() => {
      setLoadingCalendars(true);
      setRefreshingCalendar(true);
      setCalendarNotice("Finishing Google Calendar reconnection…");
      void fetch("/api/calendar/reconnect", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const failure = await apiError(response, "Unable to finish reconnecting Google Calendar");
          setCalendarReconnectRequired(failure.reconnect);
          throw new Error(failure.message);
        }
        return apiJson<{
          calendars: CalendarChoice[];
          selectedIds: string[];
          cache: CalendarCache;
          calendarAccess: true;
        }>(response, "Unable to finish reconnecting Google Calendar");
      })
      .then((data) => {
        setCalendarChoices(data.calendars);
        setCalendar((current) => ({ ...current, cache: data.cache, selectedIds: data.selectedIds, calendarAccess: true }));
        setCalendarReconnectRequired(false);
        setCalendarNotice("Google Calendar reconnected and refreshed.");
        window.history.replaceState({}, "", url.pathname);
      })
      .catch((error: unknown) => {
        setCalendarNotice(error instanceof Error ? error.message : "Unable to finish reconnecting Google Calendar.");
      })
      .finally(() => {
        setLoadingCalendars(false);
        setRefreshingCalendar(false);
      });
    }, 0);
    return () => window.clearTimeout(completion);
  }, [calendar.authenticated, calendar.loading]);

  useEffect(() => {
    if (tasksLoaded.current) window.localStorage.setItem("home-dashboard-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (recipesLoaded.current) window.localStorage.setItem("home-dashboard-daily-recipes", JSON.stringify(dailyRecipes));
  }, [dailyRecipes]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/calendar", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar request failed");
        return response.json() as Promise<Omit<CalendarState, "loading">>;
      })
      .then((data) => setCalendar({ ...data, loading: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCalendar({ loading: false, configured: false, authenticated: false, cache: null, selectedIds: [], missingVariables: [] });
      });
    return () => controller.abort();
  }, []);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = taskLabel.trim();
    if (!label) return;
    setTasks((current) => [...current, { id: Date.now(), label, done: false }]);
    setTaskLabel("");
  }

  const calendarTimeZone = calendar.cache?.timeZone || calendar.timeZone || "America/Denver";
  const selectedCalendarSet = new Set(calendarChoices
    ? calendarChoices.filter((choice) => choice.selected).map((choice) => choice.id)
    : calendar.selectedIds);
  const dayEvents = (calendar.cache?.events ?? [])
    .filter((event) => event.days.includes(selectedDate) && selectedCalendarSet.has(event.calendarId))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);
  const todayKey = now ? localDateKey(now) : "";
  const dateIsCached = Boolean(
    calendar.cache && selectedDate >= calendar.cache.rangeStart && selectedDate < calendar.cache.rangeEnd,
  );

  async function refreshCalendar() {
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
      const response = await fetch("/api/calendar/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone }),
      });
      const data = await response.json() as { cache?: CalendarCache | null; error?: string; retryAfter?: number; reconnect?: boolean };
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
    if (calendarChoices) return;
    setLoadingCalendars(true);
    setCalendarNotice(null);
    try {
      const response = await fetch("/api/calendar/calendars");
      if (!response.ok) {
        const failure = await apiError(response, "Unable to load calendars");
        setCalendarReconnectRequired(failure.reconnect);
        throw new Error(failure.message);
      }
      const data = await apiJson<{ calendars?: CalendarChoice[] }>(response, "Unable to load calendars");
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
    if (!calendarChoices) return;
    setSavingCalendars(true);
    setCalendarNotice(null);
    try {
      const response = await fetch("/api/calendar/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedIds: calendarChoices.filter((calendar) => calendar.selected).map((calendar) => calendar.id),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver",
        }),
      });
      if (!response.ok) throw new Error((await apiError(response, "Unable to save calendars")).message);
      await apiJson(response, "Unable to save calendars");
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

  async function reconnectGoogleCalendar() {
    setCalendarNotice("Starting a fresh Google Calendar connection…");
    const disconnectResponse = await fetch("/api/calendar/disconnect", { method: "POST" });
    if (!disconnectResponse.ok) {
      setCalendarNotice((await apiError(disconnectResponse, "Unable to reset Google Calendar")).message);
      return;
    }
    await signOut({ redirect: false });
    await signIn("google", { redirectTo: "/?calendarReconnect=complete" }, {
      scope: `openid email profile ${CALENDAR_SCOPE}`,
      access_type: "offline",
      prompt: "select_account consent",
      include_granted_scopes: "true",
    });
  }

  async function signOutAndResetCalendar() {
    setCalendarNotice("Signing out and resetting Calendar…");
    const response = await fetch("/api/calendar/disconnect", { method: "POST" });
    if (!response.ok) {
      setCalendarNotice((await apiError(response, "Unable to reset Google Calendar")).message);
      return;
    }
    await signOut({ redirectTo: "/" });
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Home dashboard"><span className="brand-mark">H</span><span>Home</span></a>
        <p className="date-label">{now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) ?? "Loading today…"}</p>
        <div className="topbar-actions">
          <a className="github-link" href="https://github.com/caseyjgh/home-dashboard" target="_blank" rel="noreferrer">View source <span aria-hidden="true">↗</span></a>
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
              <button type="button" onClick={() => signIn("google", { redirectTo: "/" })}>
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
            <p className="calendar-message">No events scheduled for today.</p>
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
