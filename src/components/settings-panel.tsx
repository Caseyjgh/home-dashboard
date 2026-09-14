"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCachedCalendar } from "@/hooks/use-cached-calendar";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { requestJson } from "@/lib/client-request";
import { dateKey, PEOPLE, type Person } from "@/lib/family-model";
import { readLocal, validTasks, validRecipes, type Task, type DailyRecipe } from "@/lib/local-data";
import { FamilyStatus, useFamily } from "./family-provider";

export function SettingsPanel() {
  const { calendar } = useCachedCalendar();
  const { data, save, saving, refresh } = useFamily();
  const now = useMinuteClock();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<{ tasks: Task[]; meals: DailyRecipe[] } | null>(null);
  const [person, setPerson] = useState<Person>("Lilly");
  const [date, setDate] = useState("");
  const [includeDinner, setIncludeDinner] = useState(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { const active = new AbortController(); controller.current = active; return () => active.abort(); }, []);
  async function accountAction(action: "signin" | "reconnect" | "signout") {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const { signIn, signOut } = await import("next-auth/react");
      if (action !== "signin") {
        const { response, data: result } = await requestJson<{ error?: string }>("/api/calendar/disconnect", { method: "POST", signal: controller.current?.signal });
        if (!response.ok) throw new Error(result.error || "Calendar could not be reset.");
      }
      if (action === "signout") await signOut({ redirectTo: "/" });
      else {
        if (action === "reconnect") await signOut({ redirect: false });
        await signIn("google", { redirectTo: action === "reconnect" ? "/?calendarReconnect=complete" : "/" }, action === "reconnect" ? {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly", access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true",
        } : undefined);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sign-in could not complete. Try again when connected."); }
    finally { setBusy(false); }
  }
  return <main className="editor-page"><h1>Settings</h1><FamilyStatus />
    <section className="editor-card"><h2>Account & shared data</h2><p>Use the same Google account on the Pi and your other computers to share dinner and to-dos.</p>
      <p>{calendar.account?.email || (calendar.loading ? "Checking account…" : "Not signed in")}</p>
      <div className="button-row">{!calendar.authenticated ? <button className="primary" disabled={busy} onClick={() => void accountAction("signin")}>Sign in with Google</button> : <><button disabled={busy} onClick={() => void accountAction("reconnect")}>Reconnect Google Calendar</button><button disabled={busy} onClick={() => void accountAction("signout")}>Sign out & reset Calendar</button></>}
        <button onClick={refresh}>Refresh shared data</button><Link href="/calendar-settings" prefetch={false}>Calendar Settings</Link>
      </div><p className="muted">Resetting Calendar preserves your shared dinner and to-dos. It still resets the calendar cache for this account on all devices.</p>
      {notice && <p role="status">{notice}</p>}
    </section>
    <section className="editor-card"><h2>Previous browser entries</h2><p>Older versions kept tasks and meals only in this browser. You can import tasks and a dinner into shared storage. Original entries remain untouched.</p>
      <button onClick={() => {
        try { setLegacy({ tasks: readLocal("home-dashboard-tasks", validTasks) ?? [], meals: readLocal("home-dashboard-daily-recipes", validRecipes) ?? [] }); setNotice(""); }
        catch { setNotice("Old browser entries could not be read. Nothing has been changed."); }
      }}>Read previous browser entries</button>
      {legacy && <div className="legacy-import"><p>{legacy.tasks.length} old tasks found. Importing again will not duplicate the same entries.</p><label>Assign imported tasks to<select value={person} onChange={(event) => setPerson(event.target.value as Person)}>{PEOPLE.map((who) => <option key={who}>{who}</option>)}</select></label>
        <ul>{legacy.tasks.map((task) => <li key={task.id}>{task.label}{task.done ? " (completed)" : ""}</li>)}</ul>
        {legacy.meals.map((meal) => <p key={meal.id}><strong>{meal.label}:</strong> {meal.recipe || "No entry"}</p>)}
        {legacy.meals.find((meal) => meal.id === "dinner")?.recipe && <><label className="todo-check"><input type="checkbox" checked={includeDinner} onChange={(event) => setIncludeDinner(event.target.checked)} />Import the old dinner</label><label>Dinner import date<input type="date" value={date || (now ? dateKey(now) : "")} onChange={(event) => setDate(event.target.value)} /></label></>}
        <button className="primary" disabled={!data || saving} onClick={async () => {
          const title = legacy.meals.find((meal) => meal.id === "dinner")?.recipe;
          const saved = await save({ type: "importLegacy", tasks: legacy.tasks, person, ...(includeDinner && title ? { dinner: { date: date || (now ? dateKey(now) : ""), title } } : {}) });
          if (saved) setNotice("Previous entries imported. You can edit assignments on Edit To-Dos.");
        }}>Import into shared storage</button>
      </div>}
    </section>
    <section className="editor-card"><h2>Quick links</h2><div className="button-row"><a href="https://mail.google.com">Gmail</a><a href="https://calendar.google.com">Google Calendar</a><a href="https://open.spotify.com">Spotify</a></div></section>
    <section className="editor-card"><h2>Display</h2><p>Use landscape at 1920×1080 and 100% zoom on the Pi. The layout also stacks naturally on smaller screens. The clock pauses when hidden; calendar requests use the existing cache.</p><a href="https://github.com/Caseyjgh/home-dashboard">View source</a></section>
  </main>;
}
