export type Task = { id: number; label: string; done: boolean };
export type DailyRecipe = { id: "breakfast" | "lunch" | "dinner"; label: string; recipe: string };

export function validTasks(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every((item) => item &&
    typeof item.id === "number" && Number.isFinite(item.id) &&
    typeof item.label === "string" && typeof item.done === "boolean");
}

export function validRecipes(value: unknown): value is DailyRecipe[] {
  return Array.isArray(value) && value.length === 3 &&
    new Set(value.map((item) => item?.id)).size === 3 &&
    value.every((item) => item && ["breakfast", "lunch", "dinner"].includes(item.id) &&
      typeof item.label === "string" && typeof item.recipe === "string");
}

export function readLocal<T>(key: string, valid: (value: unknown) => value is T): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!valid(value)) throw new Error("Invalid saved data");
  return value;
}
