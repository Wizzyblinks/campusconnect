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

  for (const path of ["/api/posts", "/api/search/trending", "/api/notifications"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 401, `${path} should be routed and require authentication`);
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
