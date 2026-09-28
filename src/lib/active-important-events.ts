import type { ImportantEvent } from "./family-model";
import { getDenverDateKey } from "../../lib/schoolCalendars";

// Dates/ranges are inclusive. Keep history in storage and in the editors.
export function activeImportantEvents(entries: ImportantEvent[] | undefined, now: Date | null) {
  if (!now) return [];
  const today = getDenverDateKey(now);
  return (entries ?? []).filter(entry => (entry.endDate || entry.startDate) >= today);
}
