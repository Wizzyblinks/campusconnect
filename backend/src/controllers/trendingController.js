import User from "../models/User.js";
import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import PostShare from "../models/PostShare.js";
import { calculateTrendingScore } from "../services/trendingScore.js";

const cache = new Map();
const CACHE_MS = 60_000;

export const getTrending = async (req, res) => {
  const cacheKey = `${req.user.institution}:${req.user.campus}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const postFilter = {
      isDeleted: { $ne: true },
      visibility: { $in: ["public", "campus"] },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      $or: [
        { visibility: "public" },
        { visibility: "campus", institution: req.user.institution, campus: req.user.campus },
      ],
      author: { $nin: await User.find({ isRestricted: true }).distinct("_id") },
    };
    const posts = await Post.find(postFilter)
      .select("text author visibility institution campus hashtags createdAt")
      .populate("author", "name profile.avatar")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();
    const ids = posts.map((post) => post._id);
    const [likes, comments, shares] = await Promise.all([
      PostLike.aggregate([
        { $match: { post: { $in: ids }, createdAt: { $gte: since } } },
        { $group: { _id: "$post", count: { $sum: 1 } } },
      ]),
      PostComment.aggregate([
        { $match: { post: { $in: ids }, isDeleted: false, createdAt: { $gte: since } } },
        { $group: { _id: "$post", count: { $sum: 1 } } },
      ]),
      PostShare.aggregate([
        { $match: { post: { $in: ids }, createdAt: { $gte: since } } },
        { $group: { _id: "$post", count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = (rows) => new Map(rows.map((row) => [String(row._id), row.count]));
    const likeCounts = countMap(likes);
    const commentCounts = countMap(comments);
    const shareCounts = countMap(shares);
    const now = Date.now();
    const rankedPosts = posts.map((post) => {
      const postId = String(post._id);
      const likeCount = likeCounts.get(postId) || 0;
      const commentCount = commentCounts.get(postId) || 0;
      const shareCount = shareCounts.get(postId) || 0;
      return {
        _id: post._id,
        text: post.text,
        author: post.author,
        createdAt: post.createdAt,
        likes: likeCount,
        comments: commentCount,
        shares: shareCount,
        score: calculateTrendingScore({
          likes: likeCount,
          comments: commentCount,
          shares: shareCount,
          ageHours: (now - new Date(post.createdAt).getTime()) / 3_600_000,
        }),
      };
    }).sort((a, b) => b.score - a.score).slice(0, 10);

    const hashtagCounts = new Map();
    for (const post of posts) {
      for (const tag of post.hashtags || []) {
        const normalizedTag = tag.toLowerCase();
        const item = hashtagCounts.get(normalizedTag) || { tag: normalizedTag, posts: 0, score: 0 };
        item.posts += 1;
        item.score += calculateTrendingScore({
          likes: likeCounts.get(String(post._id)) || 0,
          comments: commentCounts.get(String(post._id)) || 0,
          shares: shareCounts.get(String(post._id)) || 0,
          ageHours: (now - new Date(post.createdAt).getTime()) / 3_600_000,
        });
        hashtagCounts.set(normalizedTag, item);
      }
    }
    const data = {
      posts: rankedPosts,
      hashtags: [...hashtagCounts.values()].sort((a, b) => b.score - a.score).slice(0, 10),
      calculatedAt: new Date(now).toISOString(),
    };
    cache.set(cacheKey, { data, expiresAt: now + CACHE_MS });
    return res.json(data);
  } catch (error) {
    console.error("Trending calculation failed:", error.message);
    return res.status(500).json({ message: "We couldn't load trending topics right now." });
  }
};
