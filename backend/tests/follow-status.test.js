import assert from "node:assert/strict";
import test from "node:test";
import { initialFollowStatus } from "../src/services/followStatus.js";

test("public profiles establish a follow immediately", () => {
  assert.equal(initialFollowStatus("public"), "ACCEPTED");
});

test("non-public profiles require an accepted follow request", () => {
  assert.equal(initialFollowStatus("private"), "PENDING");
  assert.equal(initialFollowStatus("campus"), "PENDING");
});
