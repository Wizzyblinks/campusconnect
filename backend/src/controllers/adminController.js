import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

const adminScope = (user) => ({
  institution: user.institution,
  campus: user.campus,
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isInAdminScope = (user, admin) =>
  String(user.institution) === String(admin.institution) &&
  String(user.campus) === String(admin.campus);

export const getAdminOverview = async (req, res) => {
  try {
    const scope = adminScope(req.user);
    const [totalUsers, verifiedStudents, onlineUsers] = await Promise.all([
      User.countDocuments(scope),
      User.countDocuments({ ...scope, isVerifiedStudent: true }),
      User.countDocuments({ ...scope, isOnline: true }),
    ]);
    return res.json({
      scope: "Your campus",
      counts: {
        totalUsers,
        verifiedStudents,
        onlineUsers,
        offlineUsers: Math.max(0, totalUsers - onlineUsers),
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error.message);
    return res.status(500).json({ message: "Failed to load admin overview" });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const search = req.query.search || "";
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      typeof search !== "string" ||
      search.length > 100
    ) {
      return res.status(400).json({ message: "Invalid user list filters" });
    }

    const filter = adminScope(req.user);
    if (search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role profile.avatar isVerifiedStudent isRestricted isOnline createdAt +restrictionReason +restrictedAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin user list error:", error.message);
    return res.status(500).json({ message: "Failed to load users" });
  }
};

export const setUserRestriction = async (req, res) => {
  try {
    const { id } = req.params;
    const { restricted, reason = "" } = req.body;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot restrict your own account" });
    }
    if (
      typeof restricted !== "boolean" ||
      typeof reason !== "string" ||
      reason.trim().length > 300
    ) {
      return res.status(400).json({ message: "Provide a valid restriction status and reason" });
    }

    const target = await User.findOneAndUpdate(
      {
        _id: id,
        ...adminScope(req.user),
        role: "student",
      },
      {
        $set: {
          isRestricted: restricted,
          restrictionReason: restricted ? reason.trim() : "",
          restrictedBy: restricted ? req.user._id : null,
          restrictedAt: restricted ? new Date() : null,
        },
      },
      { new: true, runValidators: true },
    ).select(
      "name email role isVerifiedStudent isRestricted isOnline +restrictionReason +restrictedAt",
    );

    if (!target) {
      return res.status(404).json({ message: "Student account not found" });
    }

    if (restricted) {
      const io = req.app.get("io");
      if (io) {
        io.in(`user:${target._id}`).disconnectSockets(true);
      }
      await User.findByIdAndUpdate(target._id, { $set: { isOnline: false } });
    }

    return res.json({
      message: restricted ? "Student account restricted" : "Student account restored",
      user: target,
    });
  } catch (error) {
    console.error("Admin user restriction error:", error.message);
    return res.status(500).json({ message: "Failed to update student account" });
  }
};

export const getMessageReports = async (req, res) => {
  try {
    const campusUserIds = await User.distinct("_id", adminScope(req.user));
    const reports = await Conversation.find({
      status: "REPORTED",
      moderationStatus: { $in: [null, "OPEN"] },
      participants: { $in: campusUserIds },
    })
      .populate("participants", "name profile.avatar institution campus")
      .populate("reportedBy", "name")
      .populate("reviewedBy", "name")
      .populate({
        path: "lastMessage",
        select: "message createdAt sender",
        populate: { path: "sender", select: "name" },
      })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();
    const scopedReports = reports
      .filter(
        (report) =>
          report.participants.length === 2 &&
          report.participants.every((participant) =>
            isInAdminScope(participant, req.user),
          ),
      )
      .slice(0, 100)
      .map((report) => ({
        ...report,
        participants: report.participants.map(
          ({ _id, name, profile }) => ({ _id, name, profile }),
        ),
      }));
    return res.json({ reports: scopedReports });
  } catch (error) {
    console.error("Admin messaging reports error:", error.message);
    return res.status(500).json({ message: "Failed to load messaging reports" });
  }
};

export const reviewMessageReport = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid conversation report ID" });
    }
    const { status, note = "" } = req.body;
    if (
      !["REVIEWED", "RESOLVED", "DISMISSED"].includes(status) ||
      typeof note !== "string" ||
      note.trim().length > 500
    ) {
      return res.status(400).json({ message: "Provide a valid report outcome and note" });
    }
    const campusUserIds = await User.distinct("_id", adminScope(req.user));
    const existingReport = await Conversation.findOne({
      _id: req.params.id,
      status: "REPORTED",
      moderationStatus: { $in: [null, "OPEN"] },
      participants: { $in: campusUserIds },
    }).populate("participants", "institution campus");
    if (
      !existingReport ||
      existingReport.participants.length !== 2 ||
      !existingReport.participants.every((participant) =>
        isInAdminScope(participant, req.user),
      )
    ) {
      return res.status(404).json({ message: "Open messaging report not found" });
    }

    const report = await Conversation.findOneAndUpdate(
      {
        _id: existingReport._id,
        status: "REPORTED",
        moderationStatus: { $in: [null, "OPEN"] },
        participants: { $all: existingReport.participants.map(({ _id }) => _id) },
      },
      {
        $set: {
          moderationStatus: status,
          moderationNote: note.trim(),
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    )
      .populate("participants", "name profile.avatar")
      .populate("reviewedBy", "name");
    if (!report) {
      return res.status(404).json({ message: "Open messaging report not found" });
    }
    return res.json({ message: "Messaging report review saved", report });
  } catch (error) {
    console.error("Admin messaging report review error:", error.message);
    return res.status(500).json({ message: "Failed to review messaging report" });
  }
};
