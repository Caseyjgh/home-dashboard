"use client";
import { useState, type FormEvent } from "react";
import { PEOPLE, personTodos, type Person, type Todo } from "@/lib/family-model";
import { FamilyStatus, useFamily } from "./family-provider";

function AddTodo({ person }: { person: Person }) {
  const { data, saving, save, status } = useFamily();
  const [text, setText] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await save({ type: "addTodo", text, person })) setText("");
  }
  return <form className="add-todo" onSubmit={submit}><label>New task for {person}<input required maxLength={300} value={text} onChange={(event) => setText(event.target.value)} disabled={!data || saving || status === "offline"} /></label><button type="submit" className="primary" disabled={!data || saving || status === "offline"}>Add task for {person}</button></form>;
}
function EditTodo({ todo, close }: { todo: Todo; close: () => void }) {
  const { data, save, saving } = useFamily();
  const [text, setText] = useState(todo.text);
  const [person, setPerson] = useState<Person>(todo.person);
  const [revision, setRevision] = useState<number | undefined>(data?.revision);
  return <form className="edit-todo" onSubmit={async (event) => {
    event.preventDefault();
    if (await save({ type: "editTodo", id: todo.id, text, person }, revision)) close();
    else setRevision(undefined);
  }}><label>Task text<input required maxLength={300} value={text} onChange={(event) => setText(event.target.value)} /></label><label>Person<select value={person} onChange={(event) => setPerson(event.target.value as Person)}>{PEOPLE.map((who) => <option key={who}>{who}</option>)}</select></label><div className="button-row"><button className="primary" disabled={saving} type="submit">Save task</button><button type="button" onClick={close}>Cancel edit</button></div></form>;
}
function TodoRow({ todo, first, last }: { todo: Todo; first: boolean; last: boolean }) {
  const { save, saving, status } = useFamily();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const disabled = saving || status === "offline";
  return <li className={`todo-editor-row ${todo.completed ? "completed" : ""}`}>
    {editing ? <EditTodo todo={todo} close={() => setEditing(false)} /> : <>
      <label className="todo-check"><input type="checkbox" checked={todo.completed} disabled={disabled} onChange={(event) => void save({ type: "completeTodo", id: todo.id, completed: event.target.checked })} /><span>{todo.text}</span></label>
      <p className="task-meta">{todo.completed ? "Completed · " : ""}Added {new Date(todo.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</p>
      <div className="button-row"><button disabled={disabled} type="button" onClick={() => setEditing(true)} aria-label={`Edit ${todo.text}`}>Edit</button><button disabled={disabled || first} type="button" onClick={() => void save({ type: "moveTodo", id: todo.id, direction: "up" })} aria-label={`Move ${todo.text} up`}>↑</button><button disabled={disabled || last} type="button" onClick={() => void save({ type: "moveTodo", id: todo.id, direction: "down" })} aria-label={`Move ${todo.text} down`}>↓</button><button disabled={disabled} className="danger" type="button" onClick={() => setDeleting(true)} aria-label={`Delete ${todo.text}`}>Delete</button></div>
      {deleting && <div className="delete-confirm"><p>Delete this task?</p><button disabled={disabled} className="danger" type="button" onClick={() => void save({ type: "deleteTodo", id: todo.id })}>Confirm delete task</button><button type="button" onClick={() => setDeleting(false)}>Cancel deletion</button></div>}
    </>}
  </li>;
}
export function TodosEditor() {
  const { data } = useFamily();
  return <main className="editor-page"><h1>Edit To-Dos</h1><p className="page-description">Completed tasks stay here so you can bring them back. Use the arrows to change their order.</p><FamilyStatus /><div className="todo-editors">{PEOPLE.map((person) => {
    const todos = data ? personTodos(data, person) : [];
    return <section className="editor-card" key={person} aria-label={`${person} editor`}><h2>{person.toUpperCase()}</h2><AddTodo person={person} />
      <ul className="editable-todos">{todos.map((todo, index) => <TodoRow key={todo.id} todo={todo} first={index === 0} last={index === todos.length - 1} />)}</ul>{data && todos.length === 0 && <p className="muted">No tasks yet.</p>}
    </section>;
  })}</div></main>;
}
