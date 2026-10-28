import assert from "node:assert/strict";
import test from "node:test";
import { getApiBaseUrl } from "./apiBaseUrl.js";

test("local development defaults to the local backend", () => {
  assert.equal(getApiBaseUrl("", true), "http://localhost:5000");
});

test("configured backend URLs do not retain a duplicated API prefix", () => {
  assert.equal(getApiBaseUrl("http://localhost:5000/api/", true), "http://localhost:5000");
});

test("configured backend URLs preserve their host and non-API path", () => {
  assert.equal(getApiBaseUrl("https://example.test/services/api", false), "https://example.test/services");
});

test("production retains the deployed backend fallback", () => {
  assert.equal(getApiBaseUrl(undefined, false), "https://campus-connect-kf4f.onrender.com");
});
