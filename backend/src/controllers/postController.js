import mongoose from "mongoose";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import PostShare from "../models/PostShare.js";
import PostReport from "../models/PostReport.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
import { getPostMediaKind } from "../services/postMediaValidation.js";
import { accessiblePostFilter, findAccessiblePost } from "../services/postAccess.js";
import { safelyCreateNotification } from "../services/notificationService.js";

const publicAuthor = "name profile.avatar isVerifiedStudent institution campus";
const parseTags = (text) =>
  [...new Set((text.match(/#[\p{L}\p{N}_]{2,40}/gu) || []).map((tag) => tag.toLowerCase()))].slice(0, 20);
const validateId = (id) => mongoose.isValidObjectId(id);

const postMetrics = async (posts, userId) => {
  const ids = posts.map((post) => post._id);
  if (!ids.length) return [];
  const [likes, comments, shares, viewerLikes] = await Promise.all([
    PostLike.aggregate([{ $match: { post: { $in: ids } } }, { $group: { _id: "$post", count: { $sum: 1 } } }]),
    PostComment.aggregate([{ $match: { post: { $in: ids }, isDeleted: false } }, { $group: { _id: "$post", count: { $sum: 1 } } }]),
    PostShare.aggregate([{ $match: { post: { $in: ids } } }, { $group: { _id: "$post", count: { $sum: 1 } } }]),
    PostLike.distinct("post", { post: { $in: ids }, user: userId }),
  ]);
  const createMap = (rows) => new Map(rows.map((row) => [String(row._id), row.count]));
  const likeCounts = createMap(likes);
  const commentCounts = createMap(comments);
  const shareCounts = createMap(shares);
  const likedIds = new Set(viewerLikes.map(String));
  return posts.map((post) => ({
    ...post,
    likesCount: likeCounts.get(String(post._id)) || 0,
    commentsCount: commentCounts.get(String(post._id)) || 0,
    sharesCount: shareCounts.get(String(post._id)) || 0,
    likedByMe: likedIds.has(String(post._id)),
  }));
};

const uploadPostMedia = (file, type) =>
  new Promise((resolve, reject) => {
    const resourceType = type === "video" ? "video" : "image";
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/posts",
        resource_type: resourceType,
        allowed_formats:
          resourceType === "video" ? ["mp4", "webm"] : ["jpg", "jpeg", "png", "gif", "webp"],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url || !result?.public_id) {
          reject(new Error("Media storage did not return a valid asset"));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType,
        });
      },
    );
    stream.end(file.buffer);
  });

const removeMedia = async (asset) => {
  if (!asset) return;
  try {
    await cloudinary.uploader.destroy(asset.publicId, {
      resource_type: asset.resourceType,
    });
  } catch (error) {
    console.error("Post media cleanup failed:", error.message);
  }
};

export const getFeedPosts = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000) {
      return res.status(400).json({ message: "Choose a valid feed page." });
    }
    const filter = accessiblePostFilter(req.user);
    filter.author = { $nin: await User.find({ isRestricted: true }).distinct("_id") };
    const posts = await Post.find(filter)
      .select("-media.publicId")
      .populate("author", publicAuthor)
      .sort({ createdAt: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean();
    return res.json({ posts: await postMetrics(posts, req.user._id), page, hasMore: posts.length === 20 });
  } catch (error) {
    console.error("Load feed posts failed:", error.message);
    return res.status(500).json({ message: "We couldn't load posts right now." });
  }
};

export const createPost = async (req, res) => {
  let uploaded;
  try {
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text && !req.file) {
      return res.status(400).json({ message: "Add some text or choose a photo or video to publish." });
    }
    if (text.length > 2000) {
      return res.status(400).json({ message: "Posts can be up to 2,000 characters long." });
    }
    if (!req.user.institution) {
      return res.status(400).json({ message: "Your student profile needs an institution before you can post." });
    }

    let media = { url: "", type: null };
    const visibility = req.body.visibility || req.user.privacy?.defaultPostVisibility || "campus";
    if (!["public", "campus", "private"].includes(visibility)) {
      return res.status(400).json({ message: "Choose a valid post visibility." });
    }
    if (req.file) {
      const actualType = getPostMediaKind(req.file.buffer);
      const claimedType = req.file.mimetype.startsWith("image/") ? "image" : "video";
      if (!actualType || actualType !== claimedType) {
        return res.status(400).json({ message: "That file isn't a supported image or video. Please choose another file." });
      }
      const sizeLimit = actualType === "image" ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
      if (req.file.size > sizeLimit) {
        return res.status(413).json({
          message: actualType === "image"
            ? "Images must be 10 MB or smaller."
            : "Videos must be 100 MB or smaller.",
        });
      }
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({ message: "Post media storage is unavailable right now. Please try again later." });
      }
      try {
        uploaded = await uploadPostMedia(req.file, actualType);
      } catch (error) {
        console.error("Post media upload failed:", error.message);
        return res.status(502).json({ message: "We couldn't upload your file. Please try again." });
      }
      media = { url: uploaded.url, type: actualType, publicId: uploaded.publicId };
    }

    let post;
    try {
      post = await Post.create({
        author: req.user._id,
        institution: req.user.institution,
        campus: req.user.campus,
        text,
        visibility,
        hashtags: parseTags(text),
        media,
      });
    } catch (error) {
      await removeMedia(uploaded);
      throw error;
    }
    return res.status(201).json({
      message: "Your post has been published successfully.",
      post: {
        _id: post._id,
        text: post.text,
        media: { url: media.url, type: media.type },
        createdAt: post.createdAt,
        author: {
          _id: req.user._id,
          name: req.user.name,
          profile: req.user.profile,
          isVerifiedStudent: req.user.isVerifiedStudent,
        },
        visibility,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        likedByMe: false,
      },
    });
  } catch (error) {
    console.error("Create post failed:", error.message);
    return res.status(500).json({ message: "We couldn't publish your post. Please try again." });
  }
};

export const getPost = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available." });
    const [postWithMetrics] = await postMetrics(
      [await Post.populate(post, { path: "author", select: publicAuthor }).then((result) => result.toObject())],
      req.user._id,
    );
    return res.json({ post: postWithMetrics });
  } catch (error) {
    console.error("Load post failed:", error.message);
    return res.status(500).json({ message: "We couldn't load this post. Please try again." });
  }
};

export const updatePost = async (req, res) => {
  let uploaded;
  let persisted = false;
  let previousMedia;
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    if (Object.keys(req.body).some((key) => !["text", "visibility"].includes(key))) {
      return res.status(400).json({ message: "Some post details couldn't be changed." });
    }
    const post = await Post.findOne({ _id: req.params.id, author: req.user._id, isDeleted: false }).select("+media.publicId");
    if (!post) return res.status(404).json({ message: "Post not found or you don't have permission to change it." });
    previousMedia = post.media?.publicId
      ? { publicId: post.media.publicId, resourceType: post.media.type === "video" ? "video" : "image" }
      : null;
    if (req.body.text !== undefined) {
      if (typeof req.body.text !== "string" || req.body.text.trim().length > 2000) {
        return res.status(400).json({ message: "Posts can be up to 2,000 characters long." });
      }
      post.text = req.body.text.trim();
      post.hashtags = parseTags(post.text);
    }
    if (req.body.visibility !== undefined) {
      if (!["public", "campus", "private"].includes(req.body.visibility)) {
        return res.status(400).json({ message: "Choose a valid post visibility." });
      }
      post.visibility = req.body.visibility;
    }
    if (req.file) {
      const actualType = getPostMediaKind(req.file.buffer);
      const claimedType = req.file.mimetype.startsWith("image/") ? "image" : "video";
      if (!actualType || actualType !== claimedType) {
        return res.status(400).json({ message: "That file isn't a supported image or video." });
      }
      const limit = actualType === "image" ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
      if (req.file.size > limit) return res.status(413).json({ message: actualType === "image" ? "Images must be 10 MB or smaller." : "Videos must be 100 MB or smaller." });
      if (!isCloudinaryConfigured()) return res.status(503).json({ message: "Post media storage is unavailable right now." });
      try {
        uploaded = await uploadPostMedia(req.file, actualType);
      } catch (error) {
        console.error("Post media update failed:", error.message);
        return res.status(502).json({ message: "We couldn't upload your file. Please try again." });
      }
      post.media = { url: uploaded.url, type: actualType, publicId: uploaded.publicId };
    }
    await post.save();
    persisted = true;
    const result = await Post.findById(post._id).select("-media.publicId")
      .populate("author", publicAuthor).lean();
    if (uploaded && previousMedia && previousMedia.publicId !== uploaded.publicId) {
      const references = await Post.countDocuments({ "media.publicId": previousMedia.publicId });
      if (!references) await removeMedia(previousMedia);
    }
    return res.json({ post: result });
  } catch (error) {
    if (!persisted) await removeMedia(uploaded);
    console.error("Update post failed:", error.message);
    return res.status(500).json({ message: "We couldn't update your post. Please try again." });
  }
};

export const deletePost = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, author: req.user._id, isDeleted: false },
      { $set: { isDeleted: true, text: "", hashtags: [] } },
      { new: true },
    );
    if (!post) return res.status(404).json({ message: "Post not found or you don't have permission to delete it." });
    return res.json({ message: "Your post has been deleted." });
  } catch (error) {
    console.error("Delete post failed:", error.message);
    return res.status(500).json({ message: "We couldn't delete your post. Please try again." });
  }
};

export const likePost = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available to like." });
    let created = false;
    let like;
    try {
      like = await PostLike.create({ post: post._id, user: req.user._id });
      created = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    if (
      created &&
      post.author.toString() !== req.user._id.toString()
    ) {
      await safelyCreateNotification({
        io: req.app.get("io"),
        recipient: post.author,
        actor: req.user._id,
        type: "post_like",
        title: "New like",
        message: `${req.user.name} liked your post.`,
        targetType: "post",
        targetId: post._id,
        sourceId: like._id,
      });
    }
    const likesCount = await PostLike.countDocuments({ post: post._id });
    return res.json({ liked: true, likesCount });
  } catch (error) {
    console.error("Like post failed:", error.message);
    return res.status(500).json({ message: "We couldn't like this post. Please try again." });
  }
};

export const unlikePost = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available to unlike." });
    await PostLike.deleteOne({ post: post._id, user: req.user._id });
    const likesCount = await PostLike.countDocuments({ post: post._id });
    return res.json({ liked: false, likesCount });
  } catch (error) {
    console.error("Unlike post failed:", error.message);
    return res.status(500).json({ message: "We couldn't update your like. Please try again." });
  }
};

export const getPostComments = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available." });
    const page = Number(req.query.page || 1);
    const parent = req.query.parent || null;
    if (!Number.isInteger(page) || page < 1 || (parent && !validateId(parent))) {
      return res.status(400).json({ message: "Choose a valid comments page." });
    }
    if (parent) {
      const parentComment = await PostComment.findOne({ _id: parent, post: post._id });
      if (!parentComment) return res.status(404).json({ message: "That comment is no longer available." });
    }
    const filter = { post: post._id, parent, isDeleted: false };
    if (!parent) {
      const parentsWithReplies = await PostComment.distinct("parent", {
        post: post._id,
        parent: { $ne: null },
        isDeleted: false,
      });
      filter.$or = [
        { isDeleted: false },
        { _id: { $in: parentsWithReplies } },
      ];
      delete filter.isDeleted;
    }
    const comments = await PostComment.find(filter)
      .populate("author", "name profile.avatar")
      .sort({ createdAt: 1 }).skip((page - 1) * 20).limit(20).lean();
    const normalizedComments = comments.map((comment) =>
      comment.isDeleted ? { ...comment, text: "Comment deleted" } : comment,
    );
    return res.json({ comments: normalizedComments, page, hasMore: comments.length === 20 });
  } catch (error) {
    console.error("Load comments failed:", error.message);
    return res.status(500).json({ message: "We couldn't load comments right now." });
  }
};

export const createPostComment = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 2000) return res.status(400).json({ message: "Comments must contain 1 to 2,000 characters." });
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available to comment on." });
    let parent = null;
    if (req.body.parent) {
      if (!validateId(req.body.parent)) return res.status(400).json({ message: "That reply target is invalid." });
      parent = await PostComment.findOne({ _id: req.body.parent, post: post._id });
      if (!parent) return res.status(404).json({ message: "That comment is no longer available." });
    }
    const comment = await PostComment.create({ post: post._id, author: req.user._id, parent: parent?._id || null, text });
    const populated = await PostComment.findById(comment._id).populate("author", "name profile.avatar").lean();
    const commentsCount = await PostComment.countDocuments({ post: post._id, isDeleted: false });
    const recipient = parent?.author || post.author;
    if (recipient.toString() !== req.user._id.toString()) {
      await safelyCreateNotification({
        io: req.app.get("io"),
        recipient,
        actor: req.user._id,
        type: "post_comment",
        title: parent ? "New reply" : "New comment",
        message: parent
          ? `${req.user.name} replied to your comment.`
          : `${req.user.name} commented on your post.`,
        targetType: "post",
        targetId: post._id,
        sourceId: comment._id,
      });
    }
    return res.status(201).json({ comment: populated, commentsCount });
  } catch (error) {
    console.error("Create comment failed:", error.message);
    return res.status(500).json({ message: "We couldn't add your comment. Please try again." });
  }
};

export const updatePostComment = async (req, res) => {
  try {
    if (!validateId(req.params.commentId)) return res.status(400).json({ message: "That comment link is invalid." });
    if (Object.keys(req.body).some((field) => field !== "text")) {
      return res.status(400).json({ message: "Only comment text can be changed." });
    }
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 2000) return res.status(400).json({ message: "Comments must contain 1 to 2,000 characters." });
    const existing = await PostComment.findOne({ _id: req.params.commentId, author: req.user._id, isDeleted: false });
    if (!existing || !(await findAccessiblePost(req.user, existing.post))) {
      return res.status(404).json({ message: "Comment not found or you don't have permission to edit it." });
    }
    const comment = await PostComment.findOneAndUpdate(
      { _id: existing._id, author: req.user._id, isDeleted: false },
      { $set: { text } },
      { new: true, runValidators: true },
    ).populate("author", "name profile.avatar");
    if (!comment) return res.status(404).json({ message: "Comment not found or you don't have permission to edit it." });
    return res.json({ comment });
  } catch (error) {
    console.error("Update comment failed:", error.message);
    return res.status(500).json({ message: "We couldn't update your comment. Please try again." });
  }
};

export const deletePostComment = async (req, res) => {
  try {
    if (!validateId(req.params.commentId)) return res.status(400).json({ message: "That comment link is invalid." });
    const comment = await PostComment.findOne({ _id: req.params.commentId, author: req.user._id, isDeleted: false });
    if (!comment || !(await findAccessiblePost(req.user, comment.post))) return res.status(404).json({ message: "Comment not found or you don't have permission to delete it." });
    comment.isDeleted = true;
    comment.text = "";
    await comment.save();
    return res.json({ message: "Your comment has been deleted." });
  } catch (error) {
    console.error("Delete comment failed:", error.message);
    return res.status(500).json({ message: "We couldn't delete your comment. Please try again." });
  }
};

export const sharePost = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available to share." });
    try {
      await PostShare.updateOne(
        { post: post._id, user: req.user._id },
        { $setOnInsert: { post: post._id, user: req.user._id } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    const sharesCount = await PostShare.countDocuments({ post: post._id });
    return res.json({ shareUrl: `/post/${post._id}`, sharesCount });
  } catch (error) {
    console.error("Share post failed:", error.message);
    return res.status(500).json({ message: "We couldn't prepare a link for this post." });
  }
};

export const reportPost = async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ message: "That post link is invalid." });
    const { reason, details = "" } = req.body;
    if (!["spam", "harassment", "misinformation", "inappropriate", "other"].includes(reason) ||
        typeof details !== "string" || details.trim().length > 500) {
      return res.status(400).json({ message: "Choose a report reason and keep details under 500 characters." });
    }
    const post = await findAccessiblePost(req.user, req.params.id);
    if (!post) return res.status(404).json({ message: "This post isn't available to report." });
    if (String(post.author) === String(req.user._id)) {
      return res.status(400).json({ message: "You can't report your own post." });
    }
    try {
      await PostReport.create({
        post: post._id,
        reporter: req.user._id,
        reason,
        details: details.trim(),
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "You've already reported this post." });
      throw error;
    }
    return res.status(201).json({ message: "Thanks. Your report has been sent to campus moderators." });
  } catch (error) {
    console.error("Report post failed:", error.message);
    return res.status(500).json({ message: "We couldn't send your report. Please try again." });
  }
};
