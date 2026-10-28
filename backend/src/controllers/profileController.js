import User from "../models/User.js";
import Institution from "../models/Institution.js";
import bcrypt from "bcrypt";

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const institution = await Institution.findById(user.institution);

    if (!institution) {
      return res.status(404).json({
        message: "Institution not found",
      });
    }

    const campus = institution.campuses.find(
      (item) => item._id.toString() === user.campus.toString(),
    );

    res.json({
      user: {
        ...user.toObject(),
        institution: {
          id: institution._id,
          name: institution.name,
          shortName: institution.shortName,
          state: institution.state,
        },
        campus: campus ? campus.name : null,
        privacy: user.privacy,
      },
    });
  } catch (error) {
    console.error("Fetch profile failed:", error.message);
    res.status(500).json({
      message: "Failed to fetch profile",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const allowedFields = new Set([
      "name", "phone", "department", "level", "bio", "avatar", "privacy",
    ]);
    if (Object.keys(req.body).some((field) => !allowedFields.has(field))) {
      return res.status(400).json({ message: "Some profile information can't be changed here." });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const maxLengths = { name: 80, phone: 30, department: 100, level: 50, bio: 300, avatar: 2048 };
    for (const [field, value] of Object.entries(req.body)) {
      if (field === "privacy") {
        if (!value || typeof value !== "object" || Array.isArray(value) ||
            Object.keys(value).some((key) => !["discoverable", "profileVisibility", "defaultPostVisibility"].includes(key))) {
          return res.status(400).json({ message: "Choose valid privacy settings." });
        }
        if (value.discoverable !== undefined && typeof value.discoverable !== "boolean") {
          return res.status(400).json({ message: "Choose whether students can discover your profile." });
        }
        if (value.profileVisibility !== undefined && !["public", "campus", "private"].includes(value.profileVisibility)) {
          return res.status(400).json({ message: "Choose a valid profile visibility." });
        }
        if (value.defaultPostVisibility !== undefined && !["public", "campus", "private"].includes(value.defaultPostVisibility)) {
          return res.status(400).json({ message: "Choose a valid default post visibility." });
        }
        user.privacy = { ...user.privacy?.toObject?.(), ...value };
        continue;
      }
      if (typeof value !== "string" || value.trim().length > maxLengths[field]) {
        return res.status(400).json({ message: `Enter a valid ${field} (up to ${maxLengths[field]} characters).` });
      }
      if (field === "avatar" && value.trim()) {
        try {
          const parsed = new URL(value.trim());
          if (parsed.protocol !== "https:") throw new Error("Unsupported protocol");
        } catch {
          return res.status(400).json({ message: "Profile picture links must be secure HTTPS URLs." });
        }
      }
      if (field === "name" && !value.trim()) {
        return res.status(400).json({ message: "Your display name can't be empty." });
      }
      if (field === "name") user.name = value.trim();
      else if (field === "avatar") user.profile.avatar = value.trim();
      else user.profile[field] = value.trim();
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        profile: user.profile,
        privacy: user.privacy,
      },
    });
  } catch (error) {
    console.error("Update profile failed:", error.message);
    res.status(500).json({
      message: "Failed to update profile",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        newPassword.length < 8 ||
        newPassword.length > 128) {
      return res.status(400).json({ message: "Enter your current password and a new password of at least 8 characters." });
    }
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: "Your current password isn't correct." });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return res.json({ message: "Password updated. Please log in again on your devices." });
  } catch (error) {
    console.error("Change password failed:", error.message);
    return res.status(500).json({ message: "We couldn't update your password. Please try again." });
  }
};
