import test from "node:test";
import assert from "node:assert/strict";
import { getThemePreference, persistThemePreference } from "./themePreference.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("theme preference defaults to light and restores the saved selection", () => {
  const storage = createStorage();
  assert.equal(getThemePreference(storage), "light");

  assert.equal(persistThemePreference("dark", storage), true);
  assert.equal(getThemePreference(storage), "dark");

  assert.equal(persistThemePreference("light", storage), true);
  assert.equal(getThemePreference(storage), "light");
});

test("theme preference rejects unknown values and handles unavailable storage", () => {
  assert.throws(() => persistThemePreference("system"), TypeError);
  assert.equal(getThemePreference({
    getItem() { throw new Error("storage unavailable"); },
  }), "light");
  assert.equal(persistThemePreference("dark", {
    setItem() { throw new Error("storage unavailable"); },
  }), false);
});
