import { createHash } from "node:crypto";

export const rankFeedCandidates = ({
  posts,
  followedAuthors,
  interests,
  currentCampus,
  seed,
  page = 1,
  pageSize = 20,
  now = Date.now(),
}) => {
  const followedAuthorIds = new Set(followedAuthors.map(String));
  const interestTags = new Set(
    [...interests].map((tag) => tag.toLowerCase().replace(/^#/, "")),
  );
  return posts
    .map((post) => {
      const authorId = String(post.author?._id || post.author);
      const ageHours = Math.max(
        0,
        (now - new Date(post.createdAt).getTime()) / 3_600_000,
      );
      const topicMatches = (post.hashtags || []).filter((tag) =>
        interestTags.has(tag.toLowerCase().replace(/^#/, "")),
      ).length;
      const engagement = Math.log1p(
        post.likesCount + post.commentsCount * 1.5 + post.sharesCount * 2,
      );
      const freshness = 1 / (1 + ageHours / 36);
      const variation = createHash("sha256")
        .update(`${seed}:${post._id}`)
        .digest()
        .readUInt32BE(0) / 0xffffffff;
      const score =
        freshness * 4 +
        engagement * 0.45 +
        (followedAuthorIds.has(authorId) ? 1.25 : 0) +
        Math.min(topicMatches, 3) * 0.4 +
        (String(post.campus) === String(currentCampus) ? 0.25 : 0) +
        variation * 0.3;
      return { post, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ post }) => post);
};
