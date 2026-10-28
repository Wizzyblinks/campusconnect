export const issueOtp = async ({
  user,
  purpose,
  OtpToken,
  sendOtpEmail,
  generateOtp,
  hashOtp,
  ttlMinutes,
  cooldownSeconds,
}) => {
  const otp = generateOtp();
  const previousToken = await OtpToken.findOne({ user: user._id, purpose });
  const previousValues = previousToken
    ? {
        otpHash: previousToken.otpHash,
        expiresAt: previousToken.expiresAt,
        attempts: previousToken.attempts,
        lockUntil: previousToken.lockUntil,
        resendCooldownUntil: previousToken.resendCooldownUntil,
        verifiedAt: previousToken.verifiedAt,
        usedAt: previousToken.usedAt,
        lastSentAt: previousToken.lastSentAt,
      }
    : null;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const otpHash = hashOtp(otp);

  const token = await OtpToken.findOneAndUpdate(
    { user: user._id, purpose },
    {
      otpHash,
      expiresAt,
      attempts: 0,
      lockUntil: null,
      resendCooldownUntil: new Date(Date.now() + cooldownSeconds * 1000),
      verifiedAt: null,
      usedAt: null,
      lastSentAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  try {
    await sendOtpEmail({
      to: user.email,
      otp,
      purpose,
      expiresInMinutes: ttlMinutes,
    });

    if (!token || token.otpHash !== otpHash) {
      const error = new Error("OTP storage did not match the issued code.");
      error.code = "OTP_STORAGE_MISMATCH";
      throw error;
    }
  } catch (error) {
    try {
      if (previousValues) {
        await OtpToken.updateOne(
          { user: user._id, purpose, otpHash },
          { $set: previousValues },
        );
      } else {
        await OtpToken.deleteOne({ user: user._id, purpose, otpHash });
      }
    } catch {
      console.error("OTP state rollback failed", {
        purpose: purpose === "signup" ? "signup" : "reset",
        code: "OTP_ROLLBACK_FAILED",
      });
    }
    throw error;
  }

  return token;
};

export const logOtpDeliveryError = (purpose, error) => {
  const safePurpose = purpose === "signup" ? "signup" : "reset";
  const safeCode =
    typeof error?.code === "string" && /^[A-Z0-9_-]{1,32}$/.test(error.code)
      ? error.code
      : "UNKNOWN";
  const safeResponseCode = Number.isInteger(error?.responseCode)
    ? error.responseCode
    : undefined;

  console.error("OTP email operation failed", {
    purpose: safePurpose,
    code: safeCode,
    ...(safeResponseCode ? { smtpResponseCode: safeResponseCode } : {}),
  });
};
