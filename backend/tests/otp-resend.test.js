import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { sendOtpEmail } from "../src/services/emailService.js";
import {
  hashOtp,
  otpMatches,
} from "../src/services/otpService.js";
import { issueOtp } from "../src/services/otpDeliveryService.js";

const user = { _id: "test-user", email: "test@example.com" };
const previousOtp = {
  otpHash: "previous-hash",
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 2,
  lockUntil: null,
  resendCooldownUntil: new Date(Date.now() - 1000),
  verifiedAt: null,
  usedAt: null,
  lastSentAt: new Date(Date.now() - 60_000),
};

const makeOtpModel = (initialToken = null) => {
  const tokens = new Map();
  if (initialToken) {
    tokens.set("signup", {
      ...initialToken,
      user: user._id,
      purpose: "signup",
    });
  }

  return {
    token: (purpose = "signup") => tokens.get(purpose),
    findOne: async (filter) => {
      const token = tokens.get(filter.purpose);
      return token ? { ...token } : null;
    },
    findOneAndUpdate: async (filter, update) => {
      const token = {
        ...tokens.get(filter.purpose),
        user: filter.user,
        purpose: filter.purpose,
        ...update,
      };
      tokens.set(filter.purpose, token);
      return token;
    },
    updateOne: async (filter, update) => {
      const token = tokens.get(filter.purpose);
      if (
        token &&
        token.user === filter.user &&
        token.purpose === filter.purpose &&
        token.otpHash === filter.otpHash
      ) {
        tokens.set(filter.purpose, { ...token, ...update.$set });
      }
      return {
        modifiedCount:
          tokens.get(filter.purpose)?.otpHash === filter.otpHash ? 1 : 0,
      };
    },
    deleteOne: async (filter) => {
      const token = tokens.get(filter.purpose);
      if (
        token &&
        token.user === filter.user &&
        token.purpose === filter.purpose &&
        token.otpHash === filter.otpHash
      ) {
        tokens.delete(filter.purpose);
      }
      return { deletedCount: tokens.has(filter.purpose) ? 0 : 1 };
    },
  };
};

const issue = (options) =>
  issueOtp({
    user,
    OtpToken: options.model,
    generateOtp: () => options.otp,
    hashOtp,
    ttlMinutes: 10,
    cooldownSeconds: 60,
    ...options,
  });

test("signup resend persists the same hash as the accepted email and resets OTP state", async () => {
  process.env.JWT_SECRET = "test-only-secret";
  const model = makeOtpModel(previousOtp);
  let mailedOtp;

  await issue({
    model,
    otp: "618204",
    purpose: "signup",
    sendOtpEmail: async ({ otp, purpose }) => {
      mailedOtp = otp;
      assert.equal(purpose, "signup");
    },
  });

  assert.equal(otpMatches(mailedOtp, model.token("signup").otpHash), true);
  assert.equal(model.token("signup").attempts, 0);
  assert.equal(model.token("signup").verifiedAt, null);
  assert.equal(model.token("signup").usedAt, null);
  assert.ok(model.token("signup").resendCooldownUntil > new Date());
});

test("password-reset purpose remains separate from signup OTP state", async () => {
  process.env.JWT_SECRET = "test-only-secret";
  const model = makeOtpModel(previousOtp);
  const existingSignupHash = model.token("signup").otpHash;

  await issue({
    model,
    otp: "742091",
    purpose: "reset",
    sendOtpEmail: async ({ purpose }) => assert.equal(purpose, "reset"),
  });

  test("email-change OTP is stored for and delivered to the pending address", async () => {
    process.env.JWT_SECRET = "test-only-secret";
    const model = makeOtpModel();
    let mailedTo;
    await issue({
      model,
      otp: "618205",
      purpose: "email_change",
      recipientEmail: "new-address@example.com",
      sendOtpEmail: async ({ to, purpose }) => {
        mailedTo = to;
        assert.equal(purpose, "email_change");
      },
    });

    assert.equal(mailedTo, "new-address@example.com");
    assert.equal(model.token("email_change").recipientEmail, "new-address@example.com");
    assert.equal(otpMatches("618205", model.token("email_change").otpHash), true);
  });

  assert.equal(model.token("reset").purpose, "reset");
  assert.equal(model.token("signup").otpHash, existingSignupHash);
  assert.notEqual(model.token("reset").otpHash, existingSignupHash);
});

test("failed resend restores the previous OTP and cooldown instead of reporting success", async () => {
  process.env.JWT_SECRET = "test-only-secret";
  const model = makeOtpModel(previousOtp);

  await assert.rejects(
    issue({
      model,
      otp: "509316",
      purpose: "signup",
      sendOtpEmail: async () => {
        const error = new Error("SMTP rejection");
        error.code = "EAUTH";
        throw error;
      },
    }),
    { code: "EAUTH" },
  );

  assert.equal(model.token("signup").otpHash, previousOtp.otpHash);
  assert.equal(model.token("signup").attempts, previousOtp.attempts);
  assert.equal(
    model.token("signup").resendCooldownUntil.getTime(),
    previousOtp.resendCooldownUntil.getTime(),
  );
});

test("OTP issuance rejects a stored hash that does not match the delivered code", async () => {
  process.env.JWT_SECRET = "test-only-secret";
  const model = makeOtpModel();
  model.findOneAndUpdate = async (filter, update) => ({
    ...update,
    user: filter.user,
    purpose: filter.purpose,
    otpHash: "mismatched-hash",
  });

  await assert.rejects(
    issue({
      model,
      otp: "264831",
      purpose: "reset",
      sendOtpEmail: async () => true,
    }),
    { code: "OTP_STORAGE_MISMATCH" },
  );
});

test("email service reports a Resend API delivery failure", async (context) => {
  const originalApiKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-only-api-key";
  context.after(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
  });

  const fetchMock = mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 422,
    json: async () => ({ message: "Recipient rejected" }),
  }));
  context.after(() => fetchMock.mock.restore());

  await assert.rejects(
    sendOtpEmail({
      to: "test@example.com",
      otp: "109284",
      purpose: "reset",
      expiresInMinutes: 10,
    }),
    { code: "RESEND_API_ERROR", statusCode: 422 },
  );
});

test("email service succeeds only after Resend returns an email ID", async (context) => {
  const originalApiKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-only-api-key";
  context.after(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
  });

  let request;
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "resend-test-email" }),
    };
  });
  context.after(() => fetchMock.mock.restore());

  assert.equal(
    await sendOtpEmail({
      to: "test@example.com",
      otp: "390571",
      purpose: "signup",
      expiresInMinutes: 10,
    }),
    true,
  );
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.deepEqual(JSON.parse(request.options.body).to, ["test@example.com"]);
});
