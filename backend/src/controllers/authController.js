import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import OtpToken from "../models/OtpToken.js";
import Institution from "../models/Institution.js";
import { sendOtpEmail } from "../services/emailService.js";
import {
  issueOtp,
  logOtpDeliveryError,
} from "../services/otpDeliveryService.js";
import {
  generateOtp,
  hashOtp,
  otpMatches,
  normalizeEmail,
  OTP_TTL_MINUTES,
  MAX_OTP_ATTEMPTS,
  OTP_LOCK_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  enforceOtpRateLimit,
} from "../services/otpService.js";

const buildOtpFailurePayload = (otpToken) => {
  if (!otpToken) {
    return { attemptsRemaining: 0 };
  }

  const attemptsUsed = otpToken.attempts || 0;
  const attemptsRemaining = Math.max(MAX_OTP_ATTEMPTS - attemptsUsed, 0);

  return {
    attemptsRemaining,
    lockedUntil: otpToken.lockUntil,
  };
};

const sendVerificationOtp = async ({ user, purpose }) => {
  return issueOtp({
    user,
    purpose,
    OtpToken,
    sendOtpEmail,
    generateOtp,
    hashOtp,
    ttlMinutes: OTP_TTL_MINUTES,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, institution, campus } = req.body;

    if (!name || !email || !password || !institution || !campus) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const institutionDoc = await Institution.findById(institution);

    if (!institutionDoc) {
      return res.status(404).json({
        message: "Institution not found",
      });
    }

    const campusExists = institutionDoc.campuses.some(
      (item) => item._id.toString() === campus,
    );

    if (!campusExists) {
      return res.status(400).json({
        message: "Campus does not belong to this institution",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      institution,
      campus,
      emailVerified: false,
      tokenVersion: 0,
    });

    try {
      await sendVerificationOtp({ user, purpose: "signup" });
    } catch (error) {
      logOtpDeliveryError("signup", error);
      await User.deleteOne({ _id: user._id });
      await OtpToken.deleteOne({ user: user._id, purpose: "signup" });

      return res.status(500).json({
        message: "We could not send the verification code. Please try again.",
      });
    }

    return res.status(201).json({
      message: "A verification code has been sent to your email.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

const verifyOtpForUser = async ({ user, purpose, otp }) => {
  const otpToken = await OtpToken.findOne({ user: user._id, purpose });

  if (!otpToken) {
    return {
      ok: false,
      status: 400,
      message: "Verification code is invalid or expired.",
    };
  }

  if (otpToken.lockUntil && otpToken.lockUntil > new Date()) {
    return {
      ok: false,
      status: 429,
      message: "Too many incorrect attempts. Please try again later.",
      retryAt: otpToken.lockUntil,
    };
  }

  if (!otpToken.expiresAt || otpToken.expiresAt <= new Date()) {
    await OtpToken.deleteOne({ _id: otpToken._id });

    return {
      ok: false,
      status: 400,
      message: "Verification code expired. Please request a new one.",
    };
  }

  if (otpToken.usedAt) {
    return {
      ok: false,
      status: 400,
      message: "This verification code has already been used.",
    };
  }

  const isValidOtp = otpMatches(otp, otpToken.otpHash);

  if (!isValidOtp) {
    otpToken.attempts = (otpToken.attempts || 0) + 1;

    if (otpToken.attempts >= MAX_OTP_ATTEMPTS) {
      otpToken.lockUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000);
      otpToken.attempts = 0;
    }

    await otpToken.save();

    return {
      ok: false,
      status: 400,
      message: "Invalid verification code.",
      ...buildOtpFailurePayload(otpToken),
    };
  }

  return { ok: true, otpToken };
};

export const verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address",
      });
    }

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        message: "Enter the six-digit verification code",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        message: "This email is already verified",
      });
    }

    const verification = await verifyOtpForUser({
      user,
      purpose: "signup",
      otp: String(otp),
    });

    if (!verification.ok) {
      return res.status(verification.status).json({
        message: verification.message,
        ...(verification.retryAt ? { retryAt: verification.retryAt } : {}),
        ...(verification.attemptsRemaining !== undefined
          ? { attemptsRemaining: verification.attemptsRemaining }
          : {}),
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    verification.otpToken.usedAt = new Date();
    verification.otpToken.verifiedAt = new Date();
    verification.otpToken.expiresAt = new Date();
    await verification.otpToken.save();

    return res.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to verify your email right now",
    });
  }
};

export const resendSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        message: "If your email is registered, a new verification code has been sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        message: "This email is already verified",
      });
    }

    const rateLimitResult = enforceOtpRateLimit(normalizedEmail, "signup", "request");

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        message: "Please wait a moment before requesting another code.",
        retryAfterSeconds: Math.ceil(rateLimitResult.retryAfterMs / 1000),
      });
    }

    const existingOtp = await OtpToken.findOne({ user: user._id, purpose: "signup" });

    if (
      existingOtp &&
      existingOtp.resendCooldownUntil &&
      existingOtp.resendCooldownUntil > new Date()
    ) {
      return res.status(429).json({
        message: "Please wait before requesting a new verification code.",
        retryAfterSeconds: Math.ceil(
          (existingOtp.resendCooldownUntil - new Date()) / 1000,
        ),
      });
    }

    try {
      await sendVerificationOtp({ user, purpose: "signup" });
      return res.json({
        message: "A new verification code has been sent to your email.",
      });
    } catch (error) {
      logOtpDeliveryError("signup", error);
      return res.status(500).json({
        message: "We could not send the verification code. Please try again.",
      });
    }
  } catch (error) {
    logOtpDeliveryError("signup", error);
    return res.status(500).json({
      message: "Unable to resend the verification code at the moment",
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        message: "If an account exists for this email, a reset code has been sent.",
      });
    }

    const rateLimitResult = enforceOtpRateLimit(normalizedEmail, "reset", "request");

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        message: "Please wait a moment before requesting another reset code.",
        retryAfterSeconds: Math.ceil(rateLimitResult.retryAfterMs / 1000),
      });
    }

    const existingOtp = await OtpToken.findOne({ user: user._id, purpose: "reset" });

    if (
      existingOtp &&
      existingOtp.resendCooldownUntil &&
      existingOtp.resendCooldownUntil > new Date()
    ) {
      return res.status(429).json({
        message: "Please wait before requesting another reset code.",
        retryAfterSeconds: Math.ceil(
          (existingOtp.resendCooldownUntil - new Date()) / 1000,
        ),
      });
    }

    try {
      await sendVerificationOtp({
        user,
        purpose: "reset",
      });

      return res.status(200).json({
        message: "If an account exists for this email, a reset code has been sent.",
      });
    } catch (error) {
      logOtpDeliveryError("reset", error);
      return res.status(500).json({
        message: "We could not send the reset code. Please try again.",
      });
    }
  } catch (error) {
    logOtpDeliveryError("reset", error);
    return res.status(500).json({
      message: "Unable to process your password reset request",
    });
  }
};

export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "A valid email is required",
      });
    }

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        message: "Enter the six-digit reset code",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset code.",
      });
    }

    const resetVerification = await verifyOtpForUser({
      user,
      purpose: "reset",
      otp: String(otp),
    });

    if (!resetVerification.ok) {
      return res.status(resetVerification.status).json({
        message: resetVerification.message,
        ...(resetVerification.retryAt ? { retryAt: resetVerification.retryAt } : {}),
        ...(resetVerification.attemptsRemaining !== undefined
          ? { attemptsRemaining: resetVerification.attemptsRemaining }
          : {}),
      });
    }

    resetVerification.otpToken.verifiedAt = new Date();
    await resetVerification.otpToken.save();

    return res.json({
      message: "Reset code verified successfully.",
      verified: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to verify the reset code right now",
    });
  }
};

export const resendPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        message: "If an account exists for this email, a reset code has been sent.",
      });
    }

    const rateLimitResult = enforceOtpRateLimit(normalizedEmail, "reset", "request");

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        message: "Please wait a moment before requesting another reset code.",
        retryAfterSeconds: Math.ceil(rateLimitResult.retryAfterMs / 1000),
      });
    }

    const existingOtp = await OtpToken.findOne({ user: user._id, purpose: "reset" });

    if (
      existingOtp &&
      existingOtp.resendCooldownUntil &&
      existingOtp.resendCooldownUntil > new Date()
    ) {
      return res.status(429).json({
        message: "Please wait before requesting another reset code.",
        retryAfterSeconds: Math.ceil(
          (existingOtp.resendCooldownUntil - new Date()) / 1000,
        ),
      });
    }

    try {
      await sendVerificationOtp({
        user,
        purpose: "reset",
      });

      return res.status(200).json({
        message: "A new reset code has been sent to your email.",
      });
    } catch (error) {
      logOtpDeliveryError("reset", error);
      return res.status(500).json({
        message: "We could not send the reset code. Please try again.",
      });
    }
  } catch (error) {
    logOtpDeliveryError("reset", error);
    return res.status(500).json({
      message: "Unable to resend the reset code at the moment",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "A valid email is required",
      });
    }

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        message: "Enter the six-digit reset code",
      });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        message: "New password and confirmation are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset code.",
      });
    }

    const resetOtp = await OtpToken.findOne({ user: user._id, purpose: "reset" });

    if (!resetOtp || !resetOtp.verifiedAt || resetOtp.usedAt) {
      return res.status(400).json({
        message: "Reset code has expired or has already been used.",
      });
    }

    if (resetOtp.lockUntil && resetOtp.lockUntil > new Date()) {
      return res.status(429).json({
        message: "Too many incorrect attempts. Please try again later.",
        retryAt: resetOtp.lockUntil,
      });
    }

    if (!resetOtp.expiresAt || resetOtp.expiresAt <= new Date()) {
      await OtpToken.deleteOne({ _id: resetOtp._id });

      return res.status(400).json({
        message: "Reset code expired. Please request a new one.",
      });
    }

    const isValidOtp = otpMatches(String(otp), resetOtp.otpHash);

    if (!isValidOtp) {
      resetOtp.attempts = (resetOtp.attempts || 0) + 1;

      if (resetOtp.attempts >= MAX_OTP_ATTEMPTS) {
        resetOtp.lockUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000);
        resetOtp.attempts = 0;
      }

      await resetOtp.save();

      return res.status(400).json({
        message: "Invalid verification code.",
        ...buildOtpFailurePayload(resetOtp),
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    resetOtp.usedAt = new Date();
    resetOtp.expiresAt = new Date();
    resetOtp.otpHash = hashOtp(generateOtp());
    await resetOtp.save();

    return res.json({
      message: "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to reset your password right now",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    if (user.isRestricted) {
      return res.status(403).json({
        message: "Your account has been restricted",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const institutionData = await Institution.findById(user.institution);
    const campusData = institutionData?.campuses.id(user.campus);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: institutionData
          ? {
              _id: institutionData._id,
              name: institutionData.name,
              shortName: institutionData.shortName,
            }
          : null,
        campus: campusData
          ? {
              _id: campusData._id,
              name: campusData.name,
            }
          : null,
        role: user.role,
        isVerifiedStudent: user.isVerifiedStudent,
        emailVerified: user.emailVerified,
      },
    });
  } catch {
    console.error("Login failed due to a server error.");
    return res.status(500).json({
      message: "We couldn't sign you in right now. Please try again.",
    });
  }
};
