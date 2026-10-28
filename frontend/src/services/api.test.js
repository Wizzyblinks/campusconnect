import assert from "node:assert/strict";
import test from "node:test";
import {
  apiRequest,
  expireSession,
  getTokenExpiration,
  isTokenExpired,
} from "./api.js";

const makeToken = (exp) => {
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `header.${payload}.signature`;
};

const withBrowserStorage = async (values, callback) => {
  const storage = new Map(Object.entries(values));
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const events = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: (event) => events.push(event.type) },
  });
  try {
    await callback({ storage, events });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) {
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    } else {
      delete globalThis.localStorage;
    }
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete globalThis.window;
    }
  }
};

test("JWT expiration is parsed and malformed tokens are treated as expired", () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  const token = makeToken(expiresAt);
  assert.equal(getTokenExpiration(token), expiresAt * 1000);
  assert.equal(isTokenExpired(token), false);
  assert.equal(isTokenExpired(makeToken(expiresAt - 120)), true);
  assert.equal(isTokenExpired("not-a-jwt"), true);
});

test("expired sessions clear saved auth and dispatch one expiration event", async () => {
  await withBrowserStorage({
    token: makeToken(Math.floor(Date.now() / 1000) - 60),
    user: JSON.stringify({ id: "user-1" }),
  }, async ({ storage, events }) => {
    await assert.rejects(
      apiRequest("/api/posts"),
      (error) => error.status === 401 && /session has expired/i.test(error.message),
    );
    assert.equal(storage.has("token"), false);
    assert.equal(storage.has("user"), false);
    assert.deepEqual(events, ["campus-connect:session-expired"]);
  });
});

test("authenticated 401 responses expire the session but 403 responses do not", async () => {
  const token = makeToken(Math.floor(Date.now() / 1000) + 300);
  await withBrowserStorage({ token, user: JSON.stringify({ id: "user-1" }) }, async ({ storage, events }) => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Invalid or expired token" }),
    });
    await assert.rejects(apiRequest("/api/profile"), (error) => error.status === 401);
    assert.equal(storage.has("token"), false);
    assert.deepEqual(events, ["campus-connect:session-expired"]);

    storage.set("token", token);
    storage.set("user", JSON.stringify({ id: "user-1" }));
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Account restricted" }),
    });
    await assert.rejects(apiRequest("/api/profile"), (error) => error.status === 403);
    assert.equal(storage.get("token"), token);
    assert.equal(events.length, 1);
  });
});

test("invalid login credentials do not expire an existing saved session", async () => {
  const token = makeToken(Math.floor(Date.now() / 1000) + 300);
  await withBrowserStorage({ token, user: JSON.stringify({ id: "user-1" }) }, async ({ storage, events }) => {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, undefined);
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: "Invalid email or password" }),
      };
    };
    await assert.rejects(
      apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({}) }),
      /Invalid email or password/,
    );
    assert.equal(storage.get("token"), token);
    assert.equal(events.length, 0);
  });
});

test("logout cleanup clears both the token and saved user", async () => {
  const token = makeToken(Math.floor(Date.now() / 1000) + 300);
  await withBrowserStorage({ token, user: JSON.stringify({ id: "user-1" }) }, async ({ storage, events }) => {
    assert.equal(expireSession(token), true);
    assert.equal(storage.has("token"), false);
    assert.equal(storage.has("user"), false);
    assert.deepEqual(events, ["campus-connect:session-expired"]);
  });
});
