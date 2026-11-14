import User from "../models/User.js";
import Institution from "../models/Institution.js";
import bcrypt from "bcrypt";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
import { getPostMediaKind } from "../services/postMediaValidation.js";
import OtpToken from "../models/OtpToken.js";
import { sendOtpEmail } from "../services/emailService.js";
import {
  issueOtp,
  logOtpDeliveryError,
} from "../services/otpDeliveryService.js";
import {
  enforceOtpRateLimit,
  generateOtp,
  hashOtp,
  normalizeEmail,
  otpMatches,
  MAX_OTP_ATTEMPTS,
  OTP_LOCK_MINUTES,
  OTP_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS,
} from "../services/otpService.js";
import { isValidUsername, normalizeUsername } from "../services/usernames.js";

const isDuplicateKeyError = (error) => error?.code === 11000;

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
      "name", "username", "phone", "department", "level", "bio", "privacy",
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
      if (field === "username") {
        if (typeof value !== "string") {
          return res.status(400).json({ message: "Choose a valid username." });
        }
        const username = normalizeUsername(value);
        if (!isValidUsername(username)) {
          return res.status(400).json({
            message: "Username must be 3 to 24 characters, start and end with a letter or number, and contain only letters, numbers, periods, or underscores.",
          });
        }
        const existingUsername = await User.exists({
          username,
          _id: { $ne: user._id },
        });
        if (existingUsername) {
          return res.status(409).json({ message: "That username is already taken." });
        }
        user.username = username;
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
        username: user.username,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        profile: user.profile,
        privacy: user.privacy,
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error) && error.keyPattern?.username) {
      return res.status(409).json({ message: "That username is already taken." });
    }
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
        username: user.username,
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
    if (Object.keys(req.body || {}).some((field) =>
      !["currentPassword", "newPassword", "confirmPassword"].includes(field),
    )) {
      return res.status(400).json({ message: "Only password fields can be changed here." });
    }
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        typeof confirmPassword !== "string" ||
        confirmPassword !== newPassword ||
        newPassword.length < 8 ||
        newPassword.length > 128 ||
        !/[A-Za-z]/.test(newPassword) ||
        !/\d/.test(newPassword)) {
      return res.status(400).json({ message: "Enter your current password and matching new passwords of 8 to 128 characters, including at least one letter and one number." });
    }
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: "Your current password isn't correct." });
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ message: "Choose a new password different from your current password." });
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

export const requestEmailChange = async (req, res) => {
  const { email, currentPassword } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (
    Object.keys(req.body || {}).some((field) => !["email", "currentPassword"].includes(field)) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof currentPassword !== "string" ||
    currentPassword.length === 0
  ) {
    return res.status(400).json({ message: "Provide a valid new email address and your current password." });
  }

  const rateLimit = enforceOtpRateLimit(normalizedEmail, "email_change");
  if (!rateLimit.allowed) {
    return res.status(429).json({
      message: "Too many email verification requests. Please try again shortly.",
      retryAfterSeconds: Math.ceil(rateLimit.retryAfterMs / 1000),
    });
  }

  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: "Your current password isn't correct." });
    }
    if (normalizedEmail === user.email) {
      return res.status(400).json({ message: "That is already your current email address." });
    }
    if (await User.exists({ email: normalizedEmail, _id: { $ne: user._id } })) {
      return res.status(409).json({ message: "That email address is already registered." });
    }

    const previousOtp = await OtpToken.findOne({
      user: user._id,
      purpose: "email_change",
    });
    if (previousOtp?.lockUntil && previousOtp.lockUntil > new Date()) {
      return res.status(429).json({
        message: "Too many incorrect verification attempts. Please try again later.",
      });
    }
    if (previousOtp?.resendCooldownUntil && previousOtp.resendCooldownUntil > new Date()) {
      return res.status(429).json({
        message: "Please wait before requesting another verification code.",
        retryAfterSeconds: Math.ceil((previousOtp.resendCooldownUntil - Date.now()) / 1000),
      });
    }

    const previousPendingEmail = user.pendingEmail;
    user.pendingEmail = normalizedEmail;
    await user.save();

    try {
      await issueOtp({
        user,
        purpose: "email_change",
        recipientEmail: normalizedEmail,
        OtpToken,
        sendOtpEmail,
        generateOtp,
        hashOtp,
        ttlMinutes: OTP_TTL_MINUTES,
        cooldownSeconds: RESEND_COOLDOWN_SECONDS,
      });
    } catch (error) {
      user.pendingEmail = previousPendingEmail;
      await user.save();
      logOtpDeliveryError("email_change", error);
      return res.status(502).json({
        message: "We couldn't send a verification code to that address. Please try again.",
      });
    }

    return res.json({
      message: "A verification code has been sent to your new email address.",
      pendingEmail: normalizedEmail,
    });
  } catch (error) {
    console.error("Email change request failed:", error.message);
    return res.status(500).json({ message: "We couldn't request an email change right now." });
  }
};

export const verifyEmailChange = async (req, res) => {
  const { otp } = req.body || {};
  if (
    Object.keys(req.body || {}).some((field) => field !== "otp") ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    return res.status(400).json({ message: "Enter the six-digit verification code." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user?.pendingEmail) {
      return res.status(400).json({ message: "There is no pending email change to verify." });
    }

    const rateLimit = enforceOtpRateLimit(user.pendingEmail, "email_change", "verify");
    if (!rateLimit.allowed) {
      return res.status(429).json({
        message: "Too many verification attempts. Please wait before trying again.",
        retryAfterSeconds: Math.ceil(rateLimit.retryAfterMs / 1000),
      });
    }

    const otpToken = await OtpToken.findOne({
      user: user._id,
      purpose: "email_change",
    });
    if (!otpToken || otpToken.usedAt || otpToken.recipientEmail !== user.pendingEmail) {
      return res.status(400).json({ message: "Verification code is invalid or expired." });
    }
    if (otpToken.lockUntil && otpToken.lockUntil > new Date()) {
      return res.status(429).json({ message: "Too many incorrect attempts. Please try again later." });
    }
    if (!otpToken.expiresAt || otpToken.expiresAt <= new Date()) {
      await OtpToken.deleteOne({ _id: otpToken._id });
      return res.status(400).json({ message: "Verification code expired. Request a new one." });
    }
    if (!otpMatches(String(otp), otpToken.otpHash)) {
      otpToken.attempts = (otpToken.attempts || 0) + 1;
      if (otpToken.attempts >= MAX_OTP_ATTEMPTS) {
        otpToken.lockUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000);
        otpToken.attempts = 0;
      }
      await otpToken.save();
      return res.status(400).json({ message: "Invalid verification code." });
    }
    if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) {
      user.pendingEmail = null;
      await user.save();
      return res.status(409).json({ message: "That email address is already registered." });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    otpToken.usedAt = new Date();
    otpToken.verifiedAt = new Date();
    otpToken.expiresAt = new Date();
    await otpToken.save();

    return res.json({
      message: "Your email address has been updated. Please log in again.",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profile: user.profile,
        privacy: user.privacy,
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error) && error.keyPattern?.email) {
      return res.status(409).json({ message: "That email address is already registered." });
    }
    console.error("Email change verification failed:", error.message);
    return res.status(500).json({ message: "We couldn't verify the new email address." });
  }
};
