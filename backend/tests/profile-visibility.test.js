import assert from "node:assert/strict";
import test from "node:test";
import { canViewProfile } from "../src/services/profileVisibility.js";

const viewer = {
  _id: "student-a",
  institution: "institution-a",
  campus: "campus-a",
};

const target = (privacy = {}) => ({
  _id: "student-b",
  institution: "institution-a",
  campus: "campus-a",
  privacy: { discoverable: true, profileVisibility: "campus", ...privacy },
});

test("profile visibility allows public and same-campus profiles but blocks other campuses", () => {
  assert.equal(canViewProfile(viewer, target({ profileVisibility: "public" })), true);
  assert.equal(canViewProfile(viewer, target()), true);
  assert.equal(canViewProfile(viewer, {
    ...target({ profileVisibility: "campus" }),
    campus: "campus-b",
  }), false);
});

test("private profiles require an accepted follow and nondiscoverable profiles stay hidden", () => {
  assert.equal(canViewProfile(viewer, target({ profileVisibility: "private" })), false);
  assert.equal(canViewProfile(viewer, target({ profileVisibility: "private" }), true), true);
  assert.equal(canViewProfile(viewer, target({ discoverable: false, profileVisibility: "public" })), false);
  assert.equal(canViewProfile(viewer, { ...target(), isRestricted: true }), false);
});

test("a profile owner can view their own profile", () => {
  const ownProfile = { ...target({ profileVisibility: "private" }), _id: viewer._id };
  assert.equal(canViewProfile(viewer, ownProfile), true);
});
