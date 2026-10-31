import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessGroup,
  groupVisibilityFilter,
  isGroupMember,
} from "../src/services/groupAccess.js";
import { PUBLIC_PROFILE_FIELDS } from "../src/services/publicProfileProjection.js";

const user = {
  _id: "student-1",
  institution: "institution-1",
  campus: "campus-1",
};

const group = (overrides = {}) => ({
  institution: user.institution,
  campus: user.campus,
  status: "ACTIVE",
  isPrivate: false,
  members: [],
  ...overrides,
});

test("group access allows public campus groups and only member access to private groups", () => {
  assert.equal(canAccessGroup(group(), user), true);
  assert.equal(canAccessGroup(group({ isPrivate: true }), user), false);
  assert.equal(
    canAccessGroup(group({ isPrivate: true, members: [{ user: user._id }] }), user),
    true,
  );
});

test("inactive and cross-campus groups are inaccessible", () => {
  assert.equal(canAccessGroup(group({ status: "SUSPENDED" }), user), false);
  assert.equal(canAccessGroup(group({ campus: "campus-2" }), user), false);
  assert.equal(canAccessGroup(group({ institution: "institution-2" }), user), false);
});

test("private group listing filter only includes groups where the viewer is a member", () => {
  assert.deepEqual(groupVisibilityFilter(user), {
    institution: user.institution,
    campus: user.campus,
    status: "ACTIVE",
    $or: [{ isPrivate: { $ne: true } }, { "members.user": user._id }],
  });
  assert.equal(isGroupMember(group({ members: [{ user: { _id: user._id } }] }), user._id), true);
});

test("public populated profile fields exclude email addresses", () => {
  assert.equal(PUBLIC_PROFILE_FIELDS.includes("email"), false);
});
