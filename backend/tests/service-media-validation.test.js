import assert from "node:assert/strict";
import test from "node:test";
import { isValidServiceImage } from "../src/services/serviceMediaValidation.js";

test("service image validation matches supported MIME types to file signatures", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");

  assert.equal(isValidServiceImage(jpeg, "image/jpeg"), true);
  assert.equal(isValidServiceImage(png, "image/png"), true);
  assert.equal(isValidServiceImage(webp, "image/webp"), true);
  assert.equal(isValidServiceImage(png, "image/jpeg"), false);
  assert.equal(isValidServiceImage(Buffer.from("<svg/>"), "image/png"), false);
});
