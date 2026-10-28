import assert from "node:assert/strict";
import test from "node:test";
import { planRitmanCampusRename } from "../src/services/ritmanCampusRename.js";

test("Ritman campus rename plan preserves the existing campus record id", () => {
  const plan = planRitmanCampusRename({
    _id: "ritman-id",
    name: "Ritman University",
    campuses: [{ _id: "existing-campus-id", name: "Main Campus" }],
  });

  assert.deepEqual(plan, {
    changed: true,
    institutionId: "ritman-id",
    campusId: "existing-campus-id",
  });
});

test("Ritman campus rename is idempotent when already renamed", () => {
  assert.deepEqual(
    planRitmanCampusRename({
      _id: "ritman-id",
      name: "Ritman University",
      campuses: [{ _id: "existing-campus-id", name: "Green Campus" }],
    }),
    { changed: false, institutionId: "ritman-id" },
  );
});

test("Ritman campus rename rejects unrelated institutions and conflicting campus names", () => {
  assert.throws(
    () => planRitmanCampusRename({
      _id: "other-id",
      name: "Another University",
      campuses: [{ _id: "campus-id", name: "Main Campus" }],
    }),
  );
  assert.throws(
    () => planRitmanCampusRename({
      _id: "ritman-id",
      name: "Ritman University",
      campuses: [
        { _id: "main-id", name: "Main Campus" },
        { _id: "green-id", name: "Green Campus" },
      ],
    }),
  );
});
