"use client";
import Link from "next/link";
import { SchoolDayBanner } from "../school-day-banner";
import { FamilyStatus, useFamily } from "../family-provider";
import { useWeather } from "../weather-provider";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { useCachedCalendar } from "@/hooks/use-cached-calendar";
import { degrees, weatherDescription } from "@/lib/weather";
import { dateKey, PEOPLE, personTodos, safeRecipeLink } from "@/lib/family-model";
import { reminderDate } from "../important-events";
import { calendarEventTime } from "@/lib/calendar-display";

function MobileWeather() {
  const { forecast, unavailable } = useWeather();
  const day = forecast?.days[0];
  return <section className="mobile-card" aria-labelledby="mobile-weather-heading"><h2 id="mobile-weather-heading">Windsor weather</h2>
    {forecast && day ? <><div className="mobile-weather-current"><strong>{degrees(forecast.current.temperature)}F</strong><span>{weatherDescription(forecast.current.code)}</span></div><p>High {degrees(day.high)} · Low {degrees(day.low)} · Rain {day.precipitation === null ? "—" : `${Math.round(day.precipitation)}%`}</p>{unavailable && <p className="muted">Showing the last available forecast.</p>}</> : <p role="status">{unavailable ? "Weather is temporarily unavailable." : "Loading weather…"}</p>}
  </section>;
}
function MobileTodayCalendar({ today }: { today: string }) {
  const { calendar, connection } = useCachedCalendar();
  const events = (calendar.cache?.events ?? []).filter(event => event.days.includes(today) && calendar.selectedIds.includes(event.calendarId)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  return <section className="mobile-card" aria-labelledby="mobile-calendar-heading"><div className="mobile-card-heading"><h2 id="mobile-calendar-heading">Today’s calendar</h2><Link href="/mobile/calendar" prefetch={false}>View all</Link></div>
    {connection === "error" || connection === "offline" ? <p role="status">Connection unavailable. Showing saved events where available.</p> : null}
    {calendar.loading ? <p>Loading calendar…</p> : !calendar.authenticated ? <p>Connect Google in the Calendar tab to see your events.</p> : !calendar.cache ? <p>Open Calendar to refresh your saved events.</p> : events.length ? <ol className="mobile-calendar-events">{events.slice(0, 4).map(event => <li key={`${event.calendarId}:${event.id}`}><time>{calendarEventTime(event, calendar.cache?.timeZone || "America/Denver")}</time><div><strong>{event.title}</strong><span>{event.calendarName}</span></div></li>)}</ol> : <p>No events today.</p>}
    {events.length > 4 && <Link className="mobile-action" href="/mobile/calendar" prefetch={false}>See all {events.length} events</Link>}
  </section>;
}
export function MobileHome() {
  const { data, status, saving, save } = useFamily();
  const now = useMinuteClock();
  const today = now ? dateKey(now) : "";
  const dinner = data?.dinners.find(entry => entry.date === today);
  // Match the Pi's saved reminders; do not silently expire household entries.
  const reminders = data?.importantEvents ?? [];
  return <main className="mobile-home"><h1>Today at home</h1><FamilyStatus />
    <SchoolDayBanner showSchoolNames />
    <MobileWeather />
    <section className="mobile-card mobile-dinner" aria-labelledby="mobile-dinner-heading"><div className="mobile-card-heading"><h2 id="mobile-dinner-heading">Dinner</h2><Link href="/mobile/meals" prefetch={false}>Edit</Link></div><h3>{dinner?.title || (status === "loading" ? "Loading dinner…" : data ? "No dinner planned" : "Sign in to see dinner")}</h3>{dinner?.description && <p>{dinner.description}</p>}{dinner?.link && safeRecipeLink(dinner.link) && <a className="mobile-action" href={dinner.link} target="_blank" rel="noopener noreferrer">Open recipe</a>}</section>
    <MobileTodayCalendar today={today} />
    <section className="mobile-card" aria-labelledby="mobile-todo-heading"><h2 id="mobile-todo-heading">To-Do</h2>{PEOPLE.map(person => {
      const todos = data ? personTodos(data, person).filter(todo => !todo.completed) : [];
      return <section className="mobile-person" key={person}><h3>{person}</h3>{todos.length ? <ul>{todos.slice(0, 3).map(todo => <li key={todo.id}><label className="todo-check"><input type="checkbox" checked={false} disabled={saving || status === "offline"} onChange={() => void save({ type: "completeTodo", id: todo.id, completed: true })} /><span>{todo.text}</span></label></li>)}</ul> : <p>{data ? "All done." : "Sign in to see tasks."}</p>}{todos.length > 3 && <p className="muted">{todos.length - 3} more tasks</p>}</section>;
    })}<Link className="mobile-action" href="/mobile/todos" prefetch={false}>Manage To-Do</Link></section>
    <section className="mobile-card" aria-labelledby="mobile-events-heading"><h2 id="mobile-events-heading">Important Events</h2>{reminders.length ? <ul className="mobile-reminders">{reminders.slice(0, 4).map(entry => <li key={entry.id} className={entry.highImportance ? "high-importance" : ""}><strong>{reminderDate(entry.startDate)}{entry.endDate && entry.endDate !== entry.startDate ? ` – ${reminderDate(entry.endDate)}` : ""}</strong><p>{entry.description}</p></li>)}</ul> : <p>{data ? "No important events." : "Sign in to see events."}</p>}<Link className="mobile-action" href="/mobile/events" prefetch={false}>Manage Events</Link></section>
  </main>;
}
