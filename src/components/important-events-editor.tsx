"use client";
import { useState, type FormEvent } from "react";
import type { ImportantEvent } from "@/lib/family-model";
import { FamilyStatus, useFamily } from "./family-provider";
import { reminderDate } from "./important-events";
const blank = { startDate: "", endDate: "", description: "", highImportance: false };
type Draft = Omit<ImportantEvent, "id"> & { id?: string; revision?: number };
export function ImportantEventsEditor() {
  const { data, save, saving, status } = useFamily();
  const [draft, setDraft] = useState<Draft>(blank);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const disabled = !data || saving || status === "offline";
  function edit(patch: Partial<Draft>) { setDraft((old) => ({ ...old, revision: old.revision ?? data?.revision, ...patch })); setNotice(""); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const { id, startDate, endDate, description, highImportance } = draft;
    if (await save({ type: "saveImportantEvent", ...(id ? { id } : {}), startDate, endDate, description, highImportance }, draft.revision)) { setDraft(blank); setNotice("Important event saved."); }
    else setDraft((old) => ({ ...old, revision: undefined }));
  }
  return <main className="editor-page"><h1>Edit Important Events</h1><FamilyStatus />
    <form className="editor-card" onSubmit={submit}><fieldset disabled={disabled}>
      <div className="editor-toolbar"><label>Start date<input type="date" required value={draft.startDate} onChange={(e) => edit({ startDate: e.target.value })} /></label><label>End date (optional)<input type="date" min={draft.startDate || undefined} value={draft.endDate} onChange={(e) => edit({ endDate: e.target.value })} /></label></div>
      <label>Description<textarea aria-label="Description" required maxLength={300} rows={2} value={draft.description} onChange={(e) => edit({ description: e.target.value })} /></label>
      <label className="todo-check"><input type="checkbox" checked={draft.highImportance} onChange={(e) => edit({ highImportance: e.target.checked })} /><span>High importance</span></label>
      <div className="button-row"><button className="primary" type="submit">Save important event</button><button type="button" onClick={() => { setDraft(blank); setNotice(""); }}>New / cancel edit</button></div>
    </fieldset>{notice && <p role="status">{notice}</p>}</form>
    <section className="editor-card" aria-label="Saved important events"><ul className="important-editor-list">{data?.importantEvents?.map((entry) => <li key={entry.id} className={entry.highImportance ? "high-importance" : ""}>
      <p><strong>{reminderDate(entry.startDate)}{entry.endDate && entry.endDate !== entry.startDate ? ` – ${reminderDate(entry.endDate)}` : ""}</strong> — {entry.description}</p>
      <div className="button-row"><button disabled={disabled} onClick={() => { setDraft({ ...entry, revision: data.revision }); setNotice(""); window.scrollTo({ top: 0 }); }} aria-label={`Edit ${entry.description}`}>Edit</button><button className="danger" disabled={disabled} onClick={() => setDeleting(entry.id)} aria-label={`Delete ${entry.description}`}>Delete</button></div>
      {deleting === entry.id && <div className="delete-confirm"><p>Delete this important event?</p><button disabled={disabled} onClick={async () => { if (await save({ type: "deleteImportantEvent", id: entry.id })) { setDeleting(null); if (draft.id === entry.id) setDraft(blank); } }}>Confirm delete important event</button><button onClick={() => setDeleting(null)}>Cancel deletion</button></div>}
    </li>)}</ul>{data && !data.importantEvents?.length && <p className="muted">No important events yet.</p>}</section>
  </main>;
}
