import assert from "node:assert/strict";
import test from "node:test";
import {
  changePassword,
  requestEmailChange,
  updateProfile,
  verifyEmailChange,
} from "../src/controllers/profileController.js";
import {
  createUniqueUsername,
  isValidUsername,
  normalizeUsername,
} from "../src/services/usernames.js";

const responseStub = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("username validation accepts normalized handles and rejects invalid formats", () => {
  assert.equal(isValidUsername(normalizeUsername("Campus.Connect_1")), true);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("bad handle"), false);
  assert.equal(isValidUsername(".campus"), false);
});

test("username generation retries when a candidate is already registered", async () => {
  const candidates = new Set();
  let checks = 0;
  const username = await createUniqueUsername(
    {
      exists: async ({ username: candidate }) => {
        checks += 1;
        if (checks === 1) {
          candidates.add(candidate);
          return true;
        }
        return false;
      },
    },
    "Campus Student",
  );
  assert.equal(checks, 2);
  assert.match(username, /^campusstudent[a-f0-9]{6}$/);
});

test("profile updates reject attempts to change protected account fields", async () => {
  const res = responseStub();
  await updateProfile(
    { user: { _id: "student-id" }, body: { role: "admin" } },
    res,
  );
  assert.equal(res.statusCode, 400);
});

test("password changes require matching and sufficiently strong new passwords", async () => {
  const mismatchResponse = responseStub();
  await changePassword(
    {
      user: { _id: "student-id" },
      body: {
        currentPassword: "old-password",
        newPassword: "newpassword1",
        confirmPassword: "different1",
      },
    },
    mismatchResponse,
  );
  assert.equal(mismatchResponse.statusCode, 400);

  const weakResponse = responseStub();
  await changePassword(
    {
      user: { _id: "student-id" },
      body: {
        currentPassword: "old-password",
        newPassword: "password",
        confirmPassword: "password",
      },
    },
    weakResponse,
  );
  assert.equal(weakResponse.statusCode, 400);
});

test("email changes reject malformed requests and verification codes", async () => {
  const requestResponse = responseStub();
  await requestEmailChange(
    {
      user: { _id: "student-id" },
      body: { email: "not-an-email", currentPassword: "password" },
    },
    requestResponse,
  );
  assert.equal(requestResponse.statusCode, 400);

  const verifyResponse = responseStub();
  await verifyEmailChange(
    { user: { _id: "student-id" }, body: { otp: "123" } },
    verifyResponse,
  );
  assert.equal(verifyResponse.statusCode, 400);
});
