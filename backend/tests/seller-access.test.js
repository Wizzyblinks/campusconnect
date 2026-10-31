import assert from "node:assert/strict";
import test from "node:test";
import { createRequireSeller } from "../src/middleware/requireSeller.js";
import { submitSellerApplication } from "../src/controllers/sellerApplicationController.js";

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

test("seller-only middleware rejects pending, rejected, and suspended applicants", async () => {
  for (const status of ["PENDING", "REJECTED", "SUSPENDED"]) {
    const middleware = createRequireSeller(async () => ({
      eligible: false,
      application: { status },
    }));
    const req = { user: { _id: "buyer-id" } };
    const res = responseStub();
    let continued = false;

    await middleware(req, res, () => { continued = true; });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "SELLER_APPROVAL_REQUIRED");
    assert.equal(res.body.applicationStatus, status);
    assert.equal(continued, false);
  }
});

test("seller-only middleware permits database-qualified approved and legacy sellers", async () => {
  for (const eligibility of [
    { eligible: true, legacySeller: false, application: { status: "APPROVED" } },
    { eligible: true, legacySeller: true, application: null },
  ]) {
    const middleware = createRequireSeller(async () => eligibility);
    const req = { user: { _id: "seller-id" } };
    const res = responseStub();
    let continued = false;

    await middleware(req, res, () => { continued = true; });

    assert.equal(continued, true);
    assert.equal(req.sellerEligibility, eligibility);
    assert.equal(res.statusCode, 200);
  }
});

test("seller application requires student verification before writing an application", async () => {
  const res = responseStub();
  await submitSellerApplication(
    {
      user: { _id: "unverified-student", isVerifiedStudent: false },
      body: {
        businessName: "Campus Books",
        categories: ["books"],
        description: "Selling course books and supplies to students.",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /verification/i);
});
