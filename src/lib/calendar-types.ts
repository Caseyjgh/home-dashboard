export type CalendarEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  days: string[];
  location?: string;
};

export type CalendarChoice = {
  id: string;
  name: string;
  primary: boolean;
  selected: boolean;
  color?: string;
};

export type CalendarCache = {
  events: CalendarEvent[];
  rangeStart: string;
  rangeEnd: string;
  timeZone: string;
  refreshedAt: string;
};
