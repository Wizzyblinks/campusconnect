import mongoose from "mongoose";
import FollowRequest from "../models/FollowRequest.js";
import User from "../models/User.js";
import VibeCheckInteraction from "../models/VibeCheckInteraction.js";
import { safelyCreateNotification } from "../services/notificationService.js";
import { canViewProfile } from "../services/profileVisibility.js";
import {
  getAccessibleFollowUsers,
  paginateFollowUsers,
} from "../services/followList.js";

const findEligibleTarget = async (targetId) => {
  if (!mongoose.isValidObjectId(targetId)) return null;
  return User.findOne({
    _id: targetId,
    role: "student",
    isRestricted: { $ne: true },
    emailVerified: { $ne: false },
    "privacy.discoverable": { $ne: false },
  }).select("name institution campus privacy isRestricted emailVerified profile.avatar");
};

const isBlocked = (firstUserId, secondUserId) =>
  VibeCheckInteraction.exists({
    action: "BLOCK",
    $or: [
      { actor: firstUserId, target: secondUserId },
      { actor: secondUserId, target: firstUserId },
    ],
  });

const countsFor = async (userId) => {
  const [followersCount, followingCount] = await Promise.all([
    FollowRequest.countDocuments({ following: userId, status: "ACCEPTED" }),
    FollowRequest.countDocuments({ follower: userId, status: "ACCEPTED" }),
  ]);
  return { followersCount, followingCount };
};

const followStateFor = async (viewerId, targetId) =>
  FollowRequest.findOne({ follower: viewerId, following: targetId }).select("status");

export const getFollowState = async (req, res) => {
  try {
    const target = await findEligibleTarget(req.params.id);
    if (!target || (await isBlocked(req.user._id, target._id))) {
      return res.status(404).json({ message: "This profile isn't available." });
    }
    const state = await followStateFor(req.user._id, target._id);
    const [counts, viewerFollows] = await Promise.all([
      countsFor(target._id),
      FollowRequest.exists({
        follower: req.user._id,
        following: target._id,
        status: "ACCEPTED",
      }),
    ]);
    if (!canViewProfile(req.user, target, Boolean(viewerFollows))) {
      return res.status(404).json({ message: "This profile isn't available." });
    }
    return res.json({
      status: state?.status || "NONE",
      isFollowing: Boolean(viewerFollows),
      ...counts,
    });
  } catch (error) {
    console.error("Load follow state failed:", error.message);
    return res.status(500).json({ message: "We couldn't load follow details." });
  }
};

export const createFollowRequest = async (req, res) => {
  try {
    const target = await findEligibleTarget(req.params.id);
    if (!target) return res.status(404).json({ message: "This profile isn't available." });
    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot follow yourself." });
    }
    if (await isBlocked(req.user._id, target._id)) {
      return res.status(403).json({ message: "You cannot follow this account." });
    }

    let request = await FollowRequest.findOne({
      follower: req.user._id,
      following: target._id,
    });
    if (request?.status === "ACCEPTED") {
      return res.json({ message: "You already follow this student.", status: request.status });
    }
    if (request?.status === "PENDING") {
      return res.json({ message: "Your follow request is already pending.", status: request.status });
    }
    if (request) {
      request.status = "PENDING";
      request.respondedAt = null;
      await request.save();
    } else {
      try {
        request = await FollowRequest.create({
          follower: req.user._id,
          following: target._id,
          status: "PENDING",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        request = await FollowRequest.findOne({
          follower: req.user._id,
          following: target._id,
        });
        if (!request) throw error;
        request.status = "PENDING";
        request.respondedAt = null;
        await request.save();
      }
    }

    await safelyCreateNotification({
      io: req.app.get("io"),
      recipient: target._id,
      actor: req.user._id,
      type: "follow_request",
      title: "New follow request",
      message: "A student has requested to follow you.",
      targetType: "user",
      targetId: target._id,
      sourceId: request._id,
    });
    return res.status(201).json({
      message: "Follow request sent.",
      status: request.status,
    });
  } catch (error) {
    console.error("Create follow request failed:", error.message);
    return res.status(500).json({ message: "We couldn't send that follow request." });
  }
};

export const updateFollowRequest = async (req, res) => {
  try {
    const action = req.body?.action;
    if (!["accept", "decline", "cancel", "unfollow"].includes(action)) {
      return res.status(400).json({ message: "Choose a valid follow action." });
    }
    const targetId = req.params.id;
    if (!mongoose.isValidObjectId(targetId) || String(targetId) === String(req.user._id)) {
      return res.status(400).json({ message: "That follow request is invalid." });
    }

    const incoming = action === "accept" || action === "decline";
    const filter = incoming
      ? { follower: targetId, following: req.user._id, status: "PENDING" }
      : { follower: req.user._id, following: targetId, status: action === "unfollow" ? "ACCEPTED" : "PENDING" };
    const request = await FollowRequest.findOne(filter);
    if (!request) {
      return res.status(404).json({ message: "That follow request is no longer available." });
    }
    if (await isBlocked(req.user._id, targetId)) {
      return res.status(403).json({ message: "This follow relationship is unavailable." });
    }

    request.status = action === "accept"
      ? "ACCEPTED"
      : action === "decline"
        ? "DECLINED"
        : "CANCELLED";
    request.respondedAt = new Date();
    await request.save();
    return res.json({
      message: action === "accept"
        ? "Follow request accepted."
        : action === "decline"
          ? "Follow request declined."
          : action === "unfollow"
            ? "You unfollowed this student."
            : "Follow request cancelled.",
      status: request.status,
      ...(await countsFor(action === "accept" || action === "decline" ? req.user._id : targetId)),
    });
  } catch (error) {
    console.error("Update follow request failed:", error.message);
    return res.status(500).json({ message: "We couldn't update that follow request." });
  }
};

export const getFollowRequests = async (req, res) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      FollowRequest.find({ following: req.user._id, status: "PENDING" })
        .populate("follower", "name profile.avatar")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      FollowRequest.find({ follower: req.user._id, status: "PENDING" })
        .populate("following", "name profile.avatar")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);
    return res.json({ incoming, outgoing });
  } catch (error) {
    console.error("Load follow requests failed:", error.message);
    return res.status(500).json({ message: "We couldn't load follow requests." });
  }
};

export const getFollowList = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    if (
      !Number.isInteger(page) || page < 1 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50
    ) {
      return res.status(400).json({ message: "Choose valid follow-list pagination." });
    }
    const target = await findEligibleTarget(req.params.id);
    if (!target || (await isBlocked(req.user._id, target._id))) {
      return res.status(404).json({ message: "This profile isn't available." });
    }
    const viewerFollows = await FollowRequest.exists({
      follower: req.user._id,
      following: target._id,
      status: "ACCEPTED",
    });
    if (!canViewProfile(req.user, target, Boolean(viewerFollows))) {
      return res.status(404).json({ message: "This profile isn't available." });
    }

    const field = req.params.list === "followers" ? "following" : "follower";
    const inverse = req.params.list === "followers" ? "follower" : "following";
    const relationshipFilter = { [field]: target._id, status: "ACCEPTED" };
    const relationships = await FollowRequest.find(relationshipFilter)
      .select(inverse)
      .populate(inverse, "name institution campus privacy isRestricted emailVerified profile.avatar")
      .sort({ createdAt: -1 })
      .lean();
    const userIds = relationships
      .map((relationship) => relationship[inverse]?._id)
      .filter(Boolean);
    const [follows, blocks] = userIds.length
      ? await Promise.all([
        FollowRequest.find({
          follower: req.user._id,
          following: { $in: userIds },
          status: "ACCEPTED",
        }).select("following").lean(),
        VibeCheckInteraction.find({
          action: "BLOCK",
          $or: [
            { actor: req.user._id, target: { $in: userIds } },
            { target: req.user._id, actor: { $in: userIds } },
          ],
        }).select("actor target").lean(),
      ])
      : [[], []];
    const followedUserIds = new Set(follows.map((item) => String(item.following)));
    const blockedUserIds = new Set(
      blocks.map((item) =>
        String(item.actor) === String(req.user._id) ? String(item.target) : String(item.actor),
      ),
    );
    const accessibleUsers = getAccessibleFollowUsers({
      relationships,
      relationshipField: inverse,
      viewer: req.user,
      followedUserIds,
      blockedUserIds,
    });
    const result = paginateFollowUsers(accessibleUsers, page, limit);
    return res.json({
      users: result.users.map((person) => ({
        id: person._id,
        name: person.name,
        avatar: person.profile?.avatar || "",
      })),
      pagination: result.pagination,
      ...(await countsFor(target._id)),
    });
  } catch (error) {
    console.error("Load follow list failed:", error.message);
    return res.status(500).json({ message: "We couldn't load this list." });
  }
};
