"use client";
import { FitList } from "./fit-list";
import { dateKey, PEOPLE, personTodos, safeRecipeLink } from "@/lib/family-model";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { FamilyStatus, useFamily } from "./family-provider";

export function HouseholdCards() {
  const { data, saving, save, status } = useFamily();
  const now = useMinuteClock();
  const dinner = data?.dinners.find((entry) => entry.date === (now ? dateKey(now) : ""));
  const content = <><h2>DINNER</h2><h3>{dinner?.title || (status === "loading" ? "Loading dinner…" : data ? "No dinner planned" : "Dinner unavailable")}</h3>{dinner?.description && <p>{dinner.description}</p>}</>;
  return <aside className="household-column" aria-label="Dinner and to-dos">
    {dinner?.link && safeRecipeLink(dinner.link)
      ? <a className="dinner-card" href={dinner.link} target="_blank" rel="noopener noreferrer" aria-label={`${dinner.title} — open recipe in a new tab`}>{content}</a>
      : <section className="dinner-card">{content}</section>}
    <section className="todos-card" aria-labelledby="todos-heading">
      <h2 id="todos-heading">TO-DO</h2><FamilyStatus />
      <div className="people-grid">{PEOPLE.map((person) => {
        const tasks = data ? personTodos(data, person).filter((task) => !task.completed) : [];
        return <section className="person-todos" key={person} aria-label={`${person} to-dos`}><h3>{person.toUpperCase()}</h3>
          {tasks.length ? <FitList items={tasks} label={`${person} tasks`} className="task-pages" renderItem={(task) => <li key={task.id}><label className="todo-check"><input type="checkbox" checked={false} disabled={saving || status === "offline"} onChange={() => void save({ type: "completeTodo", id: task.id, completed: true })} /><span>{task.text}</span></label></li>} /> : <p className="muted">{data ? "All done." : "—"}</p>}
        </section>;
      })}</div>
    </section>
  </aside>;
}
