import assert from "node:assert/strict";
import test from "node:test";
import PostLike from "../src/models/PostLike.js";
import PostReport from "../src/models/PostReport.js";
import PostShare from "../src/models/PostShare.js";
import { accessiblePostFilter } from "../src/services/postAccess.js";
import { calculateTrendingScore } from "../src/services/trendingScore.js";

test("post access includes public, same-campus, and owner-only posts", () => {
  const user = {
    _id: "student-1",
    institution: "institution-1",
    campus: "campus-1",
  };
  const filter = accessiblePostFilter(user, "post-1");

  assert.equal(filter.isDeleted.$ne, true);
  assert.equal(filter._id, "post-1");
  assert.deepEqual(filter.$or, [
    { visibility: "public" },
    { visibility: "campus", institution: "institution-1", campus: "campus-1" },
    { visibility: "private", author: "student-1" },
  ]);
});

test("post likes, shares, and reports prevent duplicate user actions", () => {
  const hasUniquePair = (model, secondField) => model.schema.indexes().some(([index, options]) =>
    index.post === 1 && index[secondField] === 1 && options.unique === true,
  );
  assert.ok(hasUniquePair(PostLike, "user"));
  assert.ok(hasUniquePair(PostShare, "user"));
  assert.ok(hasUniquePair(PostReport, "reporter"));
});

test("trending scores increase with engagement and recency", () => {
  const base = calculateTrendingScore({ ageHours: 24 });
  assert.ok(calculateTrendingScore({ ageHours: 1 }) > base);
  assert.ok(calculateTrendingScore({ likes: 1, ageHours: 24 }) > base);
  assert.ok(calculateTrendingScore({ comments: 1, ageHours: 24 }) > base);
  assert.ok(calculateTrendingScore({ shares: 1, ageHours: 24 }) > base);
});
