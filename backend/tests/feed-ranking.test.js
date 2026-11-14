import assert from "node:assert/strict";
import test from "node:test";
import { rankFeedCandidates } from "../src/services/feedRanking.js";

const now = Date.parse("2026-01-01T12:00:00.000Z");
const post = (id, author, overrides = {}) => ({
  _id: id,
  author: { _id: author },
  campus: "campus-a",
  createdAt: new Date(now - 12 * 60 * 60 * 1000),
  hashtags: [],
  likesCount: 0,
  commentsCount: 0,
  sharesCount: 0,
  ...overrides,
});

test("feed ranking favors followed authors, matching topics, and engagement", () => {
  const followed = post("post-followed", "followed");
  const topical = post("post-topic", "other", { hashtags: ["#design"] });
  const popular = post("post-popular", "another", {
    likesCount: 20,
    commentsCount: 8,
    sharesCount: 5,
  });
  const unrelated = post("post-unrelated", "unrelated");
  const ranked = rankFeedCandidates({
    posts: [unrelated, topical, popular, followed],
    followedAuthors: ["followed"],
    interests: new Set(["design"]),
    currentCampus: "campus-a",
    seed: "test-session",
    page: 1,
    pageSize: 4,
    now,
  });

  assert.equal(ranked[0]._id, "post-popular");
  assert.ok(ranked.findIndex((item) => item._id === "post-followed") <
    ranked.findIndex((item) => item._id === "post-unrelated"));
  assert.ok(ranked.findIndex((item) => item._id === "post-topic") <
    ranked.findIndex((item) => item._id === "post-unrelated"));
});

test("feed ranking is stable for pagination within a feed session", () => {
  const posts = Array.from({ length: 5 }, (_, index) =>
    post(`post-${index}`, `author-${index}`),
  );
  const options = {
    posts,
    followedAuthors: [],
    interests: new Set(),
    currentCampus: "campus-a",
    seed: "same-session",
    now,
  };
  const firstPage = rankFeedCandidates({ ...options, page: 1, pageSize: 2 });
  const secondPage = rankFeedCandidates({ ...options, page: 2, pageSize: 2 });
  const repeatedFirstPage = rankFeedCandidates({ ...options, page: 1, pageSize: 2 });

  assert.deepEqual(firstPage.map((item) => item._id), repeatedFirstPage.map((item) => item._id));
  assert.equal(new Set([...firstPage, ...secondPage].map((item) => item._id)).size, 4);
});
