"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import type { CalendarCache, CalendarChoice, CalendarEvent } from "@/lib/calendar-types";

type Task = { id: number; label: string; done: boolean };
type CalendarState = {
  loading: boolean;
  configured: boolean;
  authenticated: boolean;
  cache: CalendarCache | null;
  selectedIds: string[];
  missingVariables: string[];
  timeZone?: string;
};

const quickLinks = [
  { label: "Gmail", detail: "Inbox", href: "https://mail.google.com", tone: "brick" },
  { label: "Calendar", detail: "Plan the day", href: "https://calendar.google.com", tone: "navy" },
  { label: "Spotify", detail: "Listen", href: "https://open.spotify.com", tone: "green" },
  { label: "GitHub", detail: "Build", href: "https://github.com", tone: "gold" },
];

const initialTasks: Task[] = [
  { id: 1, label: "Review today’s calendar", done: true },
  { id: 2, label: "Choose the day’s top priority", done: false },
  { id: 3, label: "Clear the inbox", done: false },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

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

async function apiErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: unknown };
    return typeof data.error === "string" && data.error ? data.error : `${fallback} (${response.status})`;
  } catch {
    return `${fallback} (${response.status})`;
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
  const [taskLabel, setTaskLabel] = useState("");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
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
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [calendarChoices, setCalendarChoices] = useState<CalendarChoice[] | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const tasksLoaded = useRef(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setNow(new Date());
      setSelectedDate(localDateKey(new Date()));
      const saved = window.localStorage.getItem("home-dashboard-tasks");
      if (saved) {
        try { setTasks(JSON.parse(saved) as Task[]); }
        catch { window.localStorage.removeItem("home-dashboard-tasks"); }
      }
      tasksLoaded.current = true;
    }, 0);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initialize); window.clearInterval(clock); };
  }, []);

  useEffect(() => {
    if (tasksLoaded.current) window.localStorage.setItem("home-dashboard-tasks", JSON.stringify(tasks));
  }, [tasks]);

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

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) { setRunning(false); return 25 * 60; }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const greeting = useMemo(() => {
    if (!now) return "Welcome home";
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

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
      const data = await response.json() as { cache?: CalendarCache | null; error?: string; retryAfter?: number };
      if (data.cache) setCalendar((current) => ({ ...current, cache: data.cache ?? null }));
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
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Unable to load calendars"));
      const data = await apiJson<{ calendars?: CalendarChoice[] }>(response, "Unable to load calendars");
      if (!data.calendars) throw new Error("The calendar service returned an invalid response.");
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
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Unable to save calendars"));
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

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Home dashboard"><span className="brand-mark">H</span><span>Home</span></a>
        <p className="date-label">{now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) ?? "Loading today…"}</p>
        <a className="github-link" href="https://github.com/caseyjgh/home-dashboard" target="_blank" rel="noreferrer">View source <span aria-hidden="true">↗</span></a>
      </header>

      <div className="dashboard" id="top">
        <section className="hero">
          <div>
            <p className="eyebrow">Personal dashboard</p>
            <h1>{greeting}, Casey.</h1>
            <p className="hero-copy">A quiet place to start the day, focus on what matters, and keep everything close at hand.</p>
          </div>
          <div className="clock" aria-label="Current time">{now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) ?? "—:—"}</div>
        </section>

        <section className="quick-section" aria-labelledby="quick-heading">
          <div className="section-heading">
            <div><p className="eyebrow">Shortcuts</p><h2 id="quick-heading">Open your day</h2></div>
            <span className="hint">Opens in a new tab</span>
          </div>
          <div className="quick-grid">
            {quickLinks.map((link, index) => (
              <a className={`quick-card ${link.tone}`} href={link.href} target="_blank" rel="noreferrer" key={link.label}>
                <span className="card-index">0{index + 1}</span>
                <div><strong>{link.label}</strong><span>{link.detail}</span></div>
                <span className="arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
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
          {calendarNotice && <p className="calendar-warning" role="status">{calendarNotice}</p>}
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

          <section className="panel focus-panel" aria-labelledby="focus-heading">
            <div><p className="eyebrow light">Focus ritual</p><h2 id="focus-heading">Make space for deep work.</h2></div>
            <div className="timer-wrap"><span className="timer">{formatTime(seconds)}</span><span className="timer-label">minutes of focus</span></div>
            <div className="timer-actions">
              <button className="primary-button" onClick={() => setRunning((current) => !current)}>{running ? "Pause" : "Start focus"}</button>
              <button className="text-button" onClick={() => { setRunning(false); setSeconds(25 * 60); }}>Reset</button>
            </div>
          </section>
        </div>

        <footer><span>Built for calmer days.</span><span>Tasks stay private in this browser.</span></footer>
      </div>
    </main>
  );
}
