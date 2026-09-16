"use client";
import { useState, type FormEvent } from "react";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { dateKey, type Dinner } from "@/lib/family-model";
import { FamilyStatus, useFamily } from "./family-provider";

type Draft = Omit<Dinner, "id"> & { id?: string; revision?: number };
export function DinnerEditor() {
  const { data, saving, save, status } = useFamily();
  const now = useMinuteClock();
  const [selectedDate, setSelectedDate] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const chosenDate = selectedDate || (now ? dateKey(now) : "");
  const entry = data?.dinners.find((d) => d.date === chosenDate);
  const form: Draft = draft ?? entry ?? { date: chosenDate, title: "", description: "", link: "" };
  const disabled = !data || saving || status === "offline";
  function choose(date: string) { setSelectedDate(date); setDraft(null); setConfirmDelete(false); setNotice(""); }
  function edit(field: keyof Omit<Dinner, "id">, value: string) {
    setDraft({ ...form, revision: draft?.revision ?? data?.revision, [field]: value });
    setNotice("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const { id, date, title, description, link } = form;
    if (await save({ type: "saveDinner", ...(id ? { id } : {}), date, title, description, link }, draft?.revision)) {
      setSelectedDate(date); setDraft(null); setConfirmDelete(false); setNotice("Dinner saved.");
    } else setDraft((current) => current ? { ...current, revision: undefined } : current);
  }
  return <main className="editor-page"><h1>Edit Dinner</h1><p className="page-description">Plan dinner for a date. Change the Date field to move an existing dinner.</p><FamilyStatus />
    <div className="editor-toolbar"><label>Choose dinner date<input type="date" value={chosenDate} onChange={(event) => choose(event.target.value)} /></label>
      <label>Saved dinners<select value={entry?.date || ""} onChange={(event) => { if (event.target.value) choose(event.target.value); }}><option value="">Choose an entry</option>{data?.dinners.map((d) => <option key={d.id} value={d.date}>{d.date} — {d.title}</option>)}</select></label>
    </div>
    <form className="editor-card dinner-form" onSubmit={submit}>
      <fieldset disabled={disabled}><label>Date<input type="date" required value={form.date} onChange={(event) => edit("date", event.target.value)} /></label>
        <label>Title<input required maxLength={200} value={form.title} onChange={(event) => edit("title", event.target.value)} /></label>
        <label>Description<textarea aria-label="Description" rows={4} maxLength={2000} value={form.description} onChange={(event) => edit("description", event.target.value)} /></label>
        <label>Recipe Link<input type="url" placeholder="https://…" maxLength={2048} value={form.link} onChange={(event) => edit("link", event.target.value)} /></label>
        <p className="muted">The link stays hidden on Home. Tapping the dinner card opens the recipe in a new tab.</p>
        <div className="button-row"><button className="primary" type="submit">{saving ? "Saving…" : "Save dinner"}</button><button type="button" onClick={() => { setDraft(null); setNotice(""); }}>Reload saved entry</button>{entry && <button className="danger" type="button" onClick={() => setConfirmDelete(true)}>Delete dinner</button>}</div>
        {confirmDelete && entry && <div className="delete-confirm"><p>Delete “{entry.title}” on {entry.date}?</p><button className="danger" type="button" onClick={async () => {
          if (await save({ type: "deleteDinner", id: entry.id }, data?.revision)) { setDraft(null); setConfirmDelete(false); setNotice("Dinner deleted."); }
        }}>Confirm delete dinner</button><button type="button" onClick={() => setConfirmDelete(false)}>Cancel deletion</button></div>}
      </fieldset>
      {notice && <p role="status">{notice}</p>}
    </form>
  </main>;
}
