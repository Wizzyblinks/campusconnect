import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

test("feed and trending routes are mounted and remain authenticated", async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const protectedRoutes = [
    ["GET", "/api/posts"],
    ["GET", "/api/posts/hidden"],
    ["GET", "/api/search/trending"],
    ["GET", "/api/notifications"],
    ["POST", "/api/profile/avatar"],
    ["GET", "/api/services/mine"],
    ["GET", "/api/services/requests"],
    ["POST", "/api/services/requests"],
    ["GET", "/api/services/admin/requests"],
  ];
  for (const [method, path] of protectedRoutes) {
    const response = await fetch(`${baseUrl}${path}`, { method });
    assert.equal(response.status, 401, `${method} ${path} should require authentication`);
  }

  for (const duplicatedPath of [
    "/api/api/posts",
    "/api/api/search/trending",
    "/api/api/notifications",
  ]) {
    const response = await fetch(`${baseUrl}${duplicatedPath}`);
    assert.equal(response.status, 404, `${duplicatedPath} should not be a mounted route`);
  }
});
