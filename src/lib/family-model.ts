export const PEOPLE = ["Lilly", "Sawyer"] as const;
export type Person = typeof PEOPLE[number];
export type Dinner = { id: string; date: string; title: string; description: string; link: string };
export type Todo = { id: string; text: string; person: Person; completed: boolean; sortOrder: number; createdAt: string };
export type FamilyData = { version: 1; revision: number; dinners: Dinner[]; todos: Todo[]; legacyImports: string[] };
export type FamilyCommand =
  | ({ type: "saveDinner" } & Omit<Dinner, "id"> & { id?: string })
  | { type: "deleteDinner"; id: string }
  | { type: "addTodo"; text: string; person: Person }
  | { type: "editTodo"; id: string; text: string; person: Person }
  | { type: "completeTodo"; id: string; completed: boolean }
  | { type: "deleteTodo"; id: string }
  | { type: "moveTodo"; id: string; direction: "up" | "down" }
  | { type: "importLegacy"; tasks: { id: number; label: string; done: boolean }[]; person: Person; dinner?: { date: string; title: string } };

export class FamilyError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function emptyFamily(): FamilyData {
  return { version: 1, revision: 0, dinners: [], todos: [], legacyImports: [] };
}
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeRecipeLink(value: string) {
  if (!value) return true;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export function personTodos(data: FamilyData, person: Person) {
  return data.todos.filter((todo) => todo.person === person).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FamilyError("Invalid changes.");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, max: number, optional = false) {
  if (typeof value !== "string" || value.trim().length > max || (!optional && !value.trim())) throw new FamilyError(`${name} must be ${optional ? "at most" : "between 1 and"} ${max} characters.`);
  return value.trim();
}
function person(value: unknown): Person {
  if (value !== "Lilly" && value !== "Sawyer") throw new FamilyError("Choose Lilly or Sawyer.");
  return value;
}
function bool(value: unknown) {
  if (typeof value !== "boolean") throw new FamilyError("Invalid completed status.");
  return value;
}
function dinnerFields(value: Record<string, unknown>) {
  const date = text(value.date, "Date", 10);
  if (!validDate(date)) throw new FamilyError("Choose a valid date.");
  const title = text(value.title, "Title", 200);
  const description = text(value.description, "Description", 2000, true);
  const link = text(value.link, "Recipe link", 2048, true);
  if (!safeRecipeLink(link)) throw new FamilyError("Recipe link must be an http or https URL without embedded credentials.");
  return { date, title, description, link };
}

// All mutations run on the server. Reordering uses buttons, not a drag library.
export function applyFamilyCommand(current: FamilyData, input: unknown, context: { id: () => string; now: string; hash: (value: string) => string }): FamilyData {
  const command = object(input);
  const next: FamilyData = { ...current, revision: current.revision + 1, dinners: current.dinners.map((d) => ({ ...d })), todos: current.todos.map((t) => ({ ...t })), legacyImports: [...current.legacyImports] };
  const addTodo = (label: string, who: Person, completed = false) => {
    next.todos.push({ id: context.id(), text: text(label, "Task", 300), person: who, completed, sortOrder: Math.max(-1, ...next.todos.filter((t) => t.person === who).map((t) => t.sortOrder)) + 1, createdAt: context.now });
  };
  if (command.type === "saveDinner") {
    const fields = dinnerFields(command);
    const existing = command.id === undefined ? undefined : next.dinners.find((d) => d.id === command.id);
    if (command.id !== undefined && !existing) throw new FamilyError("This dinner no longer exists. Reload and try again.", 409);
    if (next.dinners.some((d) => d.date === fields.date && d.id !== existing?.id)) throw new FamilyError("A dinner already exists on that date. Choose another date or edit that entry.", 409);
    if (existing) Object.assign(existing, fields);
    else next.dinners.push({ id: context.id(), ...fields });
  } else if (command.type === "deleteDinner") {
    if (!next.dinners.some((d) => d.id === command.id)) throw new FamilyError("This dinner no longer exists.", 409);
    next.dinners = next.dinners.filter((d) => d.id !== command.id);
  } else if (command.type === "addTodo") {
    addTodo(text(command.text, "Task", 300), person(command.person));
  } else if (command.type === "importLegacy") {
    const who = person(command.person);
    if (!Array.isArray(command.tasks) || command.tasks.length > 1000) throw new FamilyError("Invalid old task list.");
    for (const entry of command.tasks) {
      const old = object(entry);
      if (typeof old.id !== "number" || !Number.isFinite(old.id)) throw new FamilyError("Invalid old task identifier.");
      const label = text(old.label, "Task", 300);
      const marker = context.hash(`task:${old.id}:${label}`);
      if (!next.legacyImports.includes(marker)) {
        addTodo(label, who, bool(old.done));
        next.legacyImports.push(marker);
      }
    }
    if (command.dinner !== undefined) {
      const old = object(command.dinner);
      const fields = dinnerFields({ ...old, description: "", link: "" });
      const marker = context.hash(`dinner:${fields.date}:${fields.title}`);
      if (!next.legacyImports.includes(marker)) {
        if (next.dinners.some((d) => d.date === fields.date)) throw new FamilyError("A dinner already exists on the import date. Nothing was imported; choose another date.", 409);
        next.dinners.push({ id: context.id(), ...fields });
        next.legacyImports.push(marker);
      }
    }
  } else {
    const todo = next.todos.find((t) => t.id === command.id);
    if (!todo) throw new FamilyError("This task no longer exists. Reload and try again.", 409);
    if (command.type === "editTodo") {
      todo.text = text(command.text, "Task", 300);
      const who = person(command.person);
      if (todo.person !== who) todo.sortOrder = Math.max(-1, ...next.todos.filter((t) => t.person === who).map((t) => t.sortOrder)) + 1;
      todo.person = who;
    } else if (command.type === "completeTodo") todo.completed = bool(command.completed);
    else if (command.type === "deleteTodo") next.todos = next.todos.filter((t) => t.id !== todo.id);
    else if (command.type === "moveTodo") {
      if (command.direction !== "up" && command.direction !== "down") throw new FamilyError("Invalid task movement.");
      const ordered = personTodos(next, todo.person);
      const index = ordered.findIndex((t) => t.id === todo.id);
      const adjacent = ordered[index + (command.direction === "up" ? -1 : 1)];
      if (adjacent) [todo.sortOrder, adjacent.sortOrder] = [adjacent.sortOrder, todo.sortOrder];
    } else throw new FamilyError("Unknown change.");
  }
  for (const who of PEOPLE) personTodos(next, who).forEach((todo, index) => { todo.sortOrder = index; });
  next.dinners.sort((a, b) => a.date.localeCompare(b.date));
  if (next.todos.length > 1000 || next.dinners.length > 1000 || next.legacyImports.length > 2000) throw new FamilyError("Storage limit reached. Remove old entries before adding more.");
  return next;
}
