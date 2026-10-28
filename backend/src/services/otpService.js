import crypto from "crypto";

export const OTP_TTL_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_LOCK_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;

const rateLimitStore = new Map();

export const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

export const generateOtp = () =>
  crypto.randomInt(100000, 1000000).toString().padStart(6, "0");

export const hashOtp = (otp) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(String(otp))
    .digest("hex");

export const otpMatches = (submittedOtp, storedHash) => {
  const submittedHash = Buffer.from(hashOtp(submittedOtp), "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (submittedHash.length !== storedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(submittedHash, storedBuffer);
  } catch {
    return false;
  }
};

export const enforceOtpRateLimit = (email, purpose, action = "request") => {
  const key = `${purpose}:${normalizeEmail(email)}:${action}`;
  const now = Date.now();
  const windowMs = action === "verify" ? 60 * 1000 : 60 * 1000;
  const maxRequests = action === "verify" ? 6 : 3;

  const entries = rateLimitStore.get(key) || [];
  const recentEntries = entries.filter((timestamp) => now - timestamp < windowMs);

  if (recentEntries.length >= maxRequests) {
    const oldest = recentEntries[0];
    const retryAfterMs = windowMs - (now - oldest);

    return {
      allowed: false,
      retryAfterMs: Math.max(retryAfterMs, 1000),
    };
  }

  recentEntries.push(now);
  rateLimitStore.set(key, recentEntries);

  return { allowed: true, retryAfterMs: 0 };
};
