import assert from "node:assert/strict";
import { test } from "node:test";
import { validTasks, validRecipes } from "../src/lib/local-data.ts";

test("invalid persisted state cannot reach rendering", () => {
  for (const value of [null, {}, [null], [{ id: 1, label: {}, done: false }]]) {
    assert.equal(validTasks(value), false);
  }
  assert.equal(validTasks([]), true);
  assert.equal(validTasks([{ id: 1, label: "A task", done: false }]), true);
});

test("meal data requires the three unique meal slots", () => {
  const meals = ["breakfast", "lunch", "dinner"].map((id) => ({ id, label: id, recipe: "" }));
  assert.equal(validRecipes(meals), true);
  assert.equal(validRecipes([meals[0], meals[0], meals[0]]), false);
  assert.equal(validRecipes([null, null, null]), false);
  assert.equal(validRecipes({}), false);
});
