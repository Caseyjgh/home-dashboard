"use client";
import { useState } from "react";
import { dateKey, type Dinner } from "@/lib/family-model";

function moveDay(day: string, offset: number) {
  const [year, month, date] = day.split("-").map(Number);
  return dateKey(new Date(year, month - 1, date + offset, 12));
}

export function DinnerDays({ today, selected, dinners, choose }: {
  today: string; selected: string; dinners: Dinner[]; choose: (date: string) => void;
}) {
  const [start, setStart] = useState("");
  const first = start || today;
  if (!first) return null;
  return <section className="mobile-card dinner-days" aria-label="Dinner dates">
    <div className="dinner-week-navigation"><button type="button" aria-label="Previous dinner week" onClick={() => setStart(moveDay(first, -7))}>←</button><h2>Dinner dates</h2><button type="button" aria-label="Next dinner week" onClick={() => setStart(moveDay(first, 7))}>→</button></div>
    <ul>{Array.from({ length: 7 }, (_, offset) => {
      const day = moveDay(first, offset);
      const dinner = dinners.find(entry => entry.date === day);
      const label = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      return <li key={day}><button type="button" aria-pressed={selected === day} aria-label={`${dinner ? "Edit" : "Add"} dinner for ${day}`} onClick={() => {
        choose(day);
        document.getElementById("mobile-dinner-form")?.scrollIntoView({ block: "start" });
      }}><span><strong>{label}</strong><span>{dinner?.title || "No dinner planned"}</span></span><span className="dinner-day-action">{dinner ? "Edit" : "Add dinner"}</span></button></li>;
    })}</ul>
  </section>;
}
