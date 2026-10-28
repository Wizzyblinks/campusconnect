import mongoose from "mongoose";
import Institution from "../models/Institution.js";
import User from "../models/User.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getStudentSuggestions = async (req, res) => {
  try {
    const mode = req.query.mode === "intercampus" ? "intercampus" : "campus";
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    const institutionId = typeof req.query.institution === "string" ? req.query.institution : "";
    const campusId = typeof req.query.campus === "string" ? req.query.campus : "";
    if (!Number.isInteger(page) || page < 1 || page > 10000 ||
        !Number.isInteger(limit) || limit < 1 || limit > 50 ||
        name.length > 80 ||
        (institutionId && !mongoose.isValidObjectId(institutionId)) ||
        (campusId && !mongoose.isValidObjectId(campusId))) {
      return res.status(400).json({ message: "Choose valid student search filters." });
    }

    const filter = {
      _id: { $ne: req.user._id },
      role: "student",
      isRestricted: { $ne: true },
      emailVerified: { $ne: false },
      "privacy.discoverable": { $ne: false },
      institution: mode === "campus" ? req.user.institution : { $ne: req.user.institution },
    };
    if (mode === "campus") {
      filter.campus = req.user.campus;
      filter["privacy.profileVisibility"] = { $ne: "private" };
    } else {
      filter["privacy.profileVisibility"] = "public";
      if (institutionId) {
        filter.institution = institutionId;
        if (institutionId === String(req.user.institution)) {
          filter.campus = campusId || { $ne: req.user.campus };
        } else if (campusId) {
          filter.campus = campusId;
        }
      } else if (campusId) {
        filter.campus = campusId;
      }
    }
    if (name) filter.name = { $regex: escapeRegex(name), $options: "i" };

    const [users, total, institutions] = await Promise.all([
      User.find(filter)
        .select("name institution campus profile.avatar profile.bio profile.department profile.level isVerifiedStudent")
        .populate("institution", "name shortName campuses")
        .sort({ isVerifiedStudent: -1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      mode === "intercampus"
        ? Institution.find({}).select("name campuses").sort({ name: 1 }).lean()
        : [],
    ]);

    const results = users.map((person) => ({
      id: person._id,
      name: person.name,
      avatar: person.profile?.avatar || "",
      bio: person.profile?.bio || "",
      department: person.profile?.department || "",
      level: person.profile?.level || "",
      isVerifiedStudent: person.isVerifiedStudent,
      institutionId: person.institution?._id,
      institution: person.institution?.name || "",
      campusId: person.campus,
      campus: person.institution?.campuses.find((item) =>
        String(item._id) === String(person.campus),
      )?.name || "",
    }));
    return res.json({
      mode,
      students: results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      institutions: institutions.map((item) => ({
        id: item._id,
        name: item.name,
        campuses: item.campuses.map((campus) => ({ id: campus._id, name: campus.name })),
      })),
    });
  } catch (error) {
    console.error("Student discovery failed:", error.message);
    return res.status(500).json({ message: "We couldn't load student suggestions. Please try again." });
  }
};

export const getPublicProfile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "That profile link is invalid." });
    }
    const user = await User.findOne({
      _id: req.params.id,
      role: "student",
      isRestricted: { $ne: true },
      emailVerified: { $ne: false },
      "privacy.discoverable": { $ne: false },
      $or: [
        { "privacy.profileVisibility": "public" },
        {
          institution: req.user.institution,
          campus: req.user.campus,
          "privacy.profileVisibility": { $ne: "private" },
        },
        { _id: req.user._id },
      ],
    }).select("name institution campus profile.avatar profile.bio profile.department profile.level isVerifiedStudent");
    if (!user) return res.status(404).json({ message: "This profile isn't available." });
    const institution = await Institution.findById(user.institution).select("name campuses").lean();
    return res.json({
      profile: {
        id: user._id,
        name: user.name,
        avatar: user.profile?.avatar || "",
        bio: user.profile?.bio || "",
        department: user.profile?.department || "",
        level: user.profile?.level || "",
        isVerifiedStudent: user.isVerifiedStudent,
        institution: institution?.name || "",
        campus: institution?.campuses.find((item) => String(item._id) === String(user.campus))?.name || "",
      },
    });
  } catch (error) {
    console.error("Load public profile failed:", error.message);
    return res.status(500).json({ message: "We couldn't load this profile." });
  }
};
