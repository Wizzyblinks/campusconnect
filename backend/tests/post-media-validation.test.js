import assert from "node:assert/strict";
import test from "node:test";
import { getPostMediaKind } from "../src/services/postMediaValidation.js";

test("recognizes supported image and video container signatures", () => {
  assert.equal(getPostMediaKind(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image");
  assert.equal(
    getPostMediaKind(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image",
  );
  assert.equal(
    getPostMediaKind(Buffer.concat([
      Buffer.alloc(4),
      Buffer.from("ftypisom"),
      Buffer.alloc(8),
    ])),
    "video",
  );
  assert.equal(getPostMediaKind(Buffer.from("not media")), null);
});
