import assert from "node:assert/strict";
import test from "node:test";
import {
  getResponseMessage,
  NETWORK_ERROR,
  SERVER_ERROR,
} from "./errorMessages.js";

test("technical server failures are replaced with a friendly message", () => {
  assert.equal(getResponseMessage(500, "MongoServerError: secret details", "/api/posts"), SERVER_ERROR);
  assert.equal(getResponseMessage(500, "internal detail", "/api/auth/login"), "We couldn't sign you in right now. Please try again.");
});

test("safe validation messages remain actionable", () => {
  assert.equal(getResponseMessage(400, "That verification code is incorrect. Please try again.", "/api/auth/verify-signup-otp"), "That verification code is incorrect. Please try again.");
});

test("login validation and expired sessions use distinct messages", () => {
  assert.equal(getResponseMessage(401, "Invalid email or password.", "/api/auth/login"), "Invalid email or password.");
  assert.equal(getResponseMessage(401, "anything", "/api/orders"), "Your session has expired. Please log in again.");
});

test("service unavailability and network failures have friendly messages", () => {
  assert.equal(getResponseMessage(503, "internal detail", "/api/posts"), "Campus Connect is temporarily unavailable. Please try again shortly.");
  assert.match(NETWORK_ERROR, /check your internet connection/i);
});
