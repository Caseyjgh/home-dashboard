"use client";
import { useEffect, useRef, useState } from "react";
import { useFamily } from "./family-provider";

export function reminderDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function ImportantEvents() {
  const { data } = useFamily();
  const anchor = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(1);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const parent = anchor.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => setLimit(Math.max(1, Math.floor((parent.clientHeight * .4 - 72) / 72))));
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  const entries = data?.importantEvents ?? [];
  const pages = Math.max(1, Math.ceil(entries.length / limit));
  const current = Math.min(page, pages - 1);
  return <div ref={anchor} className={`important-events ${entries.length ? "" : "empty"}`}>
    {entries.length > 0 && <section aria-labelledby="important-events-heading"><h2 id="important-events-heading">Important Events</h2><ul>{entries.slice(current * limit, (current + 1) * limit).map((entry) => <li key={entry.id} className={entry.highImportance ? "high-importance" : ""}>
      {entry.highImportance && <span className="sr-only">High importance: </span>}
      <span className="reminder-line" title={`${reminderDate(entry.startDate)}${entry.endDate && entry.endDate !== entry.startDate ? ` – ${reminderDate(entry.endDate)}` : ""} — ${entry.description}`}><span className="reminder-date">{reminderDate(entry.startDate)}{entry.endDate && entry.endDate !== entry.startDate ? ` – ${reminderDate(entry.endDate)}` : ""}</span><span aria-hidden="true"> — </span>{entry.description}</span>
    </li>)}</ul>{pages > 1 && <div className="fit-pagination"><button aria-label="Previous important reminders" disabled={current === 0} onClick={() => setPage(current - 1)}>←</button><span>{current + 1} / {pages}</span><button aria-label="Next important reminders" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>→</button></div>}</section>}
  </div>;
}
