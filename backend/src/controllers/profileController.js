import User from "../models/User.js";
import Institution from "../models/Institution.js";
import bcrypt from "bcrypt";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
import { getPostMediaKind } from "../services/postMediaValidation.js";

const matchesAvatarMimeType = (buffer, mimeType) => {
  if (getPostMediaKind(buffer) !== "image") return false;
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return mimeType === "image/webp" &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
};

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
      "name", "phone", "department", "level", "bio", "privacy",
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

    const maxLengths = { name: 80, phone: 30, department: 100, level: 50, bio: 300 };
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
      if (field === "name" && !value.trim()) {
        return res.status(400).json({ message: "Your display name can't be empty." });
      }
      if (field === "name") user.name = value.trim();
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

export const uploadProfileAvatar = async (req, res) => {
  let uploaded;
  let persisted = false;
  try {
    if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({ message: "Choose a profile picture to upload." });
    }
    if (!matchesAvatarMimeType(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: "That file isn't a supported JPG, PNG, or WebP image." });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ message: "Profile image storage is unavailable right now." });
    }

    const user = await User.findById(req.user._id).select("-password +profile.avatarPublicId");
    if (!user) return res.status(404).json({ message: "User not found." });

    uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "campus-connect/profiles",
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result?.secure_url || !result?.public_id) {
            reject(new Error("Image storage did not return a secure profile image."));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(req.file.buffer);
    });

    const previousPublicId = user.profile.avatarPublicId;
    user.profile.avatar = uploaded.url;
    user.profile.avatarPublicId = uploaded.publicId;
    await user.save();
    persisted = true;

    if (previousPublicId && previousPublicId !== uploaded.publicId) {
      const sharedAsset = await User.exists({
        _id: { $ne: user._id },
        "profile.avatarPublicId": previousPublicId,
      });
      if (!sharedAsset) {
        try {
          await cloudinary.uploader.destroy(previousPublicId, { resource_type: "image" });
        } catch (error) {
          console.error("Profile image cleanup failed:", error.message);
        }
      }
    }

    return res.json({
      message: "Profile picture updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        profile: {
          avatar: user.profile.avatar,
          phone: user.profile.phone,
          department: user.profile.department,
          level: user.profile.level,
          bio: user.profile.bio,
        },
        privacy: user.privacy,
      },
    });
  } catch (error) {
    if (!persisted && uploaded?.publicId) {
      try {
        await cloudinary.uploader.destroy(uploaded.publicId, { resource_type: "image" });
      } catch (cleanupError) {
        console.error("Failed profile image cleanup:", cleanupError.message);
      }
    }
    console.error("Profile image upload failed:", error.message);
    return res.status(502).json({ message: "We couldn't upload your profile picture. Please try again." });
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
