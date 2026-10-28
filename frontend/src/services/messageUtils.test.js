import assert from "node:assert/strict";
import test from "node:test";
import { mergeChronologicalMessages } from "./messageUtils.js";

test("deduplicates message events and keeps history chronological", () => {
  const first = { _id: "first", createdAt: "2026-10-27T10:00:00.000Z" };
  const second = { _id: "second", createdAt: "2026-10-27T10:02:00.000Z" };
  const duplicate = { ...second, message: "same persisted message" };
  const result = mergeChronologicalMessages([second, first], [duplicate]);
  assert.deepEqual(result.map((message) => message._id), ["first", "second"]);
  assert.equal(result[1].message, "same persisted message");
});
