"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Task = { id: number; label: string; done: boolean };

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

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [taskLabel, setTaskLabel] = useState("");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tasksLoaded = useRef(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setNow(new Date());
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
