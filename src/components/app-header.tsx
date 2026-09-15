"use client";
import { HeaderWeather } from "./header-weather";
import Link from "next/link";
import { useRef } from "react";
import { useMinuteClock } from "@/hooks/use-minute-clock";

const links = [["/", "Home"], ["/important-events", "Edit Important Events"], ["/dinner", "Edit Dinner"], ["/todos", "Edit To-Dos"], ["/calendar-settings", "Calendar Settings"], ["/settings", "Settings"]];
export function AppHeader() {
  const now = useMinuteClock();
  const menu = useRef<HTMLDetailsElement>(null);
  return <header className="app-header">
    <Link href="/" prefetch={false} className="brand">Home</Link>
    <div className="header-date">{now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) ?? "Today"}</div>
    <HeaderWeather />
    <div className="header-actions"><time className="clock" aria-label="Current time">{now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) ?? "—:—"}</time>
      <details className="navigation-menu" ref={menu} onKeyDown={(event) => { if (event.key === "Escape" && menu.current) menu.current.open = false; }}>
        <summary>Menu</summary>
        <nav aria-label="Main navigation">{links.map(([href, label]) => <Link key={href} href={href} prefetch={false} onClick={() => { if (menu.current) menu.current.open = false; }}>{label}</Link>)}</nav>
      </details>
    </div>
  </header>;
}
