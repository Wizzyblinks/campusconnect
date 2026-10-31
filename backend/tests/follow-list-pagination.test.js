import assert from "node:assert/strict";
import test from "node:test";
import { getAccessibleFollowUsers, paginateFollowUsers } from "../src/services/followList.js";

const viewer = {
  _id: "viewer",
  institution: "institution-1",
  campus: "campus-1",
};
const person = (id, privacy = {}) => ({
  _id: id,
  institution: "institution-1",
  campus: "campus-1",
  privacy: { discoverable: true, profileVisibility: "campus", ...privacy },
  profile: { avatar: "" },
});
const relationships = [
  person("visible-1"),
  person("private", { profileVisibility: "private" }),
  person("blocked"),
  person("visible-2"),
]
  .map((following) => ({ following }));

test("inaccessible and blocked profiles are filtered before pagination", () => {
  const users = getAccessibleFollowUsers({
    relationships,
    relationshipField: "following",
    viewer,
    followedUserIds: new Set(),
    blockedUserIds: new Set(["blocked"]),
  });
  assert.deepEqual(users.map(({ _id }) => _id), ["visible-1", "visible-2"]);
  const result = paginateFollowUsers(users, 1, 1);
  assert.deepEqual(result.users.map(({ _id }) => _id), ["visible-1"]);
  assert.deepEqual(result.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 });
});

test("private profiles appear only when the viewer follows them and empty page requests clamp", () => {
  const privateRelationships = [
    { following: person("private", { profileVisibility: "private" }) },
  ];
  assert.equal(
    getAccessibleFollowUsers({
      relationships: privateRelationships,
      relationshipField: "following",
      viewer,
    }).length,
    0,
  );
  const visible = getAccessibleFollowUsers({
    relationships: privateRelationships,
    relationshipField: "following",
    viewer,
    followedUserIds: new Set(["private"]),
  });
  assert.deepEqual(paginateFollowUsers(visible, 5, 20).pagination, {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  });
});

test("follow pagination reports zero total pages when no profiles are accessible", () => {
  assert.deepEqual(paginateFollowUsers([], 1, 20), {
    users: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});
