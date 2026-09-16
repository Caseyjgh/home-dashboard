import type { CalendarEvent } from "./calendar-types";

export function calendarEventTime(event: CalendarEvent, timeZone: string) {
  if (event.allDay) return "All day";
  const format = (value: string) => new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone,
  });
  return `${format(event.start)} – ${format(event.end)}`;
}
export function upcomingCalendarDays(events: CalendarEvent[], selectedIds: string[], after: string) {
  const selected = events.filter(event => selectedIds.includes(event.calendarId));
  const dates = [...new Set(selected.flatMap(event => event.days).filter(day => day > after))].sort().slice(0, 7);
  return dates.map(date => ({ date, events: selected.filter(event => event.days.includes(date)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)) }));
}
