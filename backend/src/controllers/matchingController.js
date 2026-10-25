import mongoose from "mongoose";
import User from "../models/User.js";
import Institution from "../models/Institution.js";
import VibeCheckInteraction from "../models/VibeCheckInteraction.js";
import VibeCheckReport from "../models/VibeCheckReport.js";

const reportReasons = new Set([
  "HARASSMENT",
  "SPAM",
  "IMPERSONATION",
  "INAPPROPRIATE",
  "OTHER",
]);

const profileFields =
  "name campus profile.avatar profile.department profile.level profile.bio vibeCheck.interests";

const normalizeInterests = (interests) => {
  if (!Array.isArray(interests) || interests.length > 10) {
    return null;
  }

  const normalized = [];
  const seen = new Set();

  for (const interest of interests) {
    if (typeof interest !== "string") {
      return null;
    }

    const value = interest.trim().replace(/\s+/g, " ");
    if (!value || value.length > 32) {
      return null;
    }

    const key = value.toLocaleLowerCase();
    if (!seen.has(key)) {
      normalized.push(value);
      seen.add(key);
    }
  }

  return normalized;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPublicProfile = (user, campuses) => {
  const campus = campuses.find(
    (item) => item._id.toString() === user.campus.toString(),
  );

  return {
    id: user._id,
    name: user.name,
    avatar: user.profile?.avatar || "",
    department: user.profile?.department || "",
    level: user.profile?.level || "",
    bio: user.profile?.bio || "",
    campus: campus?.name || "Campus",
    interests: user.vibeCheck?.interests || [],
  };
};

const getInstitution = async (user) =>
  Institution.findById(user.institution).select("campuses");

const getBlockedUserIds = async (userId) => {
  const blocks = await VibeCheckInteraction.find({
    action: "BLOCK",
    $or: [{ actor: userId }, { target: userId }],
  }).select("actor target");

  return blocks.map((block) =>
    block.actor.toString() === userId.toString() ? block.target : block.actor,
  );
};

const getMutualLikes = async (userId) => {
  const likedUserIds = await VibeCheckInteraction.distinct("target", {
    actor: userId,
    action: "LIKE",
  });

  if (likedUserIds.length === 0) {
    return [];
  }

  const reciprocalLikes = await VibeCheckInteraction.find({
    actor: { $in: likedUserIds },
    target: userId,
    action: "LIKE",
  }).select("actor");

  return reciprocalLikes.map((like) => like.actor);
};

export const getDiscovery = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "VibeCheck is for student accounts" });
    }

    const institution = await getInstitution(req.user);
    if (!institution) {
      return res.status(404).json({ message: "Institution not found" });
    }

    const { campusId, interest = "" } = req.query;
    let selectedCampusId;

    if (campusId) {
      const campus = institution.campuses.find(
        (item) => item._id.toString() === campusId,
      );
      if (!campus) {
        return res.status(400).json({ message: "Invalid campus filter" });
      }
      selectedCampusId = campus._id;
    }

    if (typeof interest !== "string" || interest.length > 32) {
      return res.status(400).json({ message: "Invalid interest filter" });
    }

    const eligible = true;
    const enabled = req.user.vibeCheck?.enabled === true;
    let profiles = [];
    let matches = [];

    if (eligible && enabled) {
      const [
        blockedUserIds,
        priorActionUserIds,
        passedByUserIds,
        mutualLikeUserIds,
      ] =
        await Promise.all([
          getBlockedUserIds(req.user._id),
          VibeCheckInteraction.distinct("target", { actor: req.user._id }),
          VibeCheckInteraction.distinct("actor", {
            target: req.user._id,
            action: "PASS",
          }),
          getMutualLikes(req.user._id),
        ]);

      const exclusions = [req.user._id, ...blockedUserIds];
      const filter = {
        _id: { $nin: exclusions },
        institution: req.user.institution,
        role: "student",
        isRestricted: { $ne: true },
        "vibeCheck.enabled": true,
      };

      if (selectedCampusId) {
        filter.campus = selectedCampusId;
      }

      if (interest.trim()) {
        filter["vibeCheck.interests"] = {
          $regex: escapeRegex(interest.trim()),
          $options: "i",
        };
      }

      const [candidateUsers, matchUsers] = await Promise.all([
        User.find({
          ...filter,
          _id: {
            $nin: [...exclusions, ...priorActionUserIds, ...passedByUserIds],
          },
        })
          .select(profileFields)
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        mutualLikeUserIds.length
          ? User.find({
              ...filter,
              _id: { $in: mutualLikeUserIds, $nin: exclusions },
            })
              .select(profileFields)
              .sort({ name: 1 })
              .limit(100)
              .lean()
          : [],
      ]);

      profiles = candidateUsers.map((user) =>
        toPublicProfile(user, institution.campuses),
      );
      matches = matchUsers.map((user) =>
        toPublicProfile(user, institution.campuses),
      );
    }

    return res.json({
      eligible,
      enabled,
      interests: req.user.vibeCheck?.interests || [],
      campuses: institution.campuses.map((campus) => ({
        id: campus._id,
        name: campus.name,
      })),
      profiles,
      matches,
    });
  } catch (error) {
    console.error("VibeCheck discovery error:", error.message);
    return res.status(500).json({ message: "Failed to load VibeCheck" });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "VibeCheck is for student accounts" });
    }

    const { enabled, interests, consentAccepted } = req.body;
    const normalizedInterests = normalizeInterests(interests);

    if (typeof enabled !== "boolean" || normalizedInterests === null) {
      return res.status(400).json({
        message: "Provide valid VibeCheck settings",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      enabled &&
      !user.vibeCheck?.enabled &&
      consentAccepted !== true
    ) {
      return res.status(400).json({
        message: "Confirm consent before opting in to VibeCheck",
      });
    }

    user.vibeCheck ??= {};
    user.vibeCheck.enabled = enabled;
    user.vibeCheck.interests = normalizedInterests;
    if (enabled) {
      user.vibeCheck.optedInAt = new Date();
    }
    await user.save();

    return res.json({
      message: enabled
        ? "You are now visible on VibeCheck"
        : "You have opted out of VibeCheck",
      enabled: user.vibeCheck.enabled,
      interests: user.vibeCheck.interests,
    });
  } catch (error) {
    console.error("VibeCheck preferences error:", error.message);
    return res.status(500).json({ message: "Failed to update VibeCheck settings" });
  }
};

export const actOnProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "VibeCheck is for student accounts" });
    }

    const { profileId } = req.params;
    const { action } = req.body;

    if (!mongoose.isValidObjectId(profileId)) {
      return res.status(400).json({ message: "Invalid VibeCheck profile" });
    }

    const targetId = new mongoose.Types.ObjectId(profileId);
    if (targetId.equals(req.user._id)) {
      return res.status(400).json({ message: "Invalid VibeCheck profile" });
    }

    if (!["LIKE", "PASS", "BLOCK"].includes(action)) {
      return res.status(400).json({ message: "Invalid profile action" });
    }

    if (!req.user.vibeCheck?.enabled) {
      return res.status(403).json({
        message: "Opt in to VibeCheck before interacting with profiles",
      });
    }

    const target = await User.findOne({
      _id: targetId,
      institution: req.user.institution,
      role: "student",
      isRestricted: { $ne: true },
      "vibeCheck.enabled": true,
    }).select("_id");

    if (!target) {
      return res.status(404).json({ message: "VibeCheck profile not found" });
    }

    const existingBlock = await VibeCheckInteraction.exists({
      action: "BLOCK",
      $or: [
        { actor: req.user._id, target: target._id },
        { actor: target._id, target: req.user._id },
      ],
    });

    if (existingBlock) {
      return res.status(404).json({ message: "VibeCheck profile not found" });
    }

    await VibeCheckInteraction.findOneAndUpdate(
      { actor: req.user._id, target: target._id },
      { $set: { action } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    const matched =
      action === "LIKE" &&
      Boolean(
        await VibeCheckInteraction.exists({
          actor: target._id,
          target: req.user._id,
          action: "LIKE",
        }),
      );

    return res.json({
      message:
        action === "BLOCK"
          ? "Profile blocked"
          : matched
            ? "You have a mutual VibeCheck connection"
            : action === "LIKE"
              ? "Profile liked"
              : "Profile passed",
      matched,
    });
  } catch (error) {
    console.error("VibeCheck profile action error:", error.message);
    return res.status(500).json({ message: "Failed to save VibeCheck action" });
  }
};

export const reportProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "VibeCheck is for student accounts" });
    }

    const { profileId } = req.params;
    const { reason, details = "" } = req.body;

    if (!mongoose.isValidObjectId(profileId)) {
      return res.status(400).json({ message: "Invalid VibeCheck profile" });
    }

    const targetId = new mongoose.Types.ObjectId(profileId);
    if (targetId.equals(req.user._id)) {
      return res.status(400).json({ message: "Invalid VibeCheck profile" });
    }

    if (
      !reportReasons.has(reason) ||
      typeof details !== "string" ||
      details.trim().length > 500
    ) {
      return res.status(400).json({ message: "Provide a valid report reason" });
    }

    const targetExists = await User.exists({
      _id: targetId,
      institution: req.user.institution,
      role: "student",
      isRestricted: { $ne: true },
    });

    if (!targetExists) {
      return res.status(404).json({ message: "VibeCheck profile not found" });
    }

    await VibeCheckReport.create({
      reporter: req.user._id,
      reportedUser: targetId,
      reason,
      details: details.trim(),
    });

    return res.status(201).json({
      message: "Report submitted for review",
    });
  } catch (error) {
    console.error("VibeCheck profile report error:", error.message);
    return res.status(500).json({ message: "Failed to submit VibeCheck report" });
  }
};

export const getVibeCheckReports = async (req, res) => {
  try {
    const { status = "OPEN" } = req.query;
    if (!["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"].includes(status)) {
      return res.status(400).json({ message: "Invalid report status" });
    }

    const reports = await VibeCheckReport.find({ status })
      .select("reporter reportedUser reason details status createdAt reviewedBy reviewedAt")
      .populate("reporter", "name")
      .populate("reportedUser", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ reports });
  } catch (error) {
    console.error("VibeCheck report queue error:", error.message);
    return res.status(500).json({ message: "Failed to load VibeCheck reports" });
  }
};

export const reviewVibeCheckReport = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["REVIEWED", "ACTIONED", "DISMISSED"].includes(status)) {
      return res.status(400).json({ message: "Invalid report review status" });
    }

    if (!mongoose.isValidObjectId(req.params.reportId)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }

    const report = await VibeCheckReport.findById(req.params.reportId);
    if (!report) {
      return res.status(404).json({ message: "VibeCheck report not found" });
    }

    report.status = status;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    await report.save();

    return res.json({
      message: "VibeCheck report review saved",
      report,
    });
  } catch (error) {
    console.error("VibeCheck report review error:", error.message);
    return res.status(500).json({ message: "Failed to review VibeCheck report" });
  }
};
