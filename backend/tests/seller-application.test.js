import assert from "node:assert/strict";
import test, { mock } from "node:test";
import mongoose from "mongoose";
import SellerApplication from "../src/models/SellerApplication.js";
import {
  reviewSellerApplication,
  submitSellerApplication,
} from "../src/controllers/sellerApplicationController.js";

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

const userId = () => new mongoose.Types.ObjectId();
const validApplicationBody = {
  businessName: "Campus Books",
  applicantName: "Student Applicant",
  applicantPhone: "08012345678",
  contactEmail: "student@example.com",
  contactInfo: "Campus pickup",
  additionalInfo: "Books are sourced from verified distributors.",
  categories: ["books"],
  description: "Selling course books and supplies to students.",
};

test("duplicate pending seller applications are rejected", async (context) => {
  const existing = { status: "PENDING" };
  const findOne = mock.method(SellerApplication, "findOne", async () => existing);
  context.after(() => findOne.mock.restore());
  const res = responseStub();

  await submitSellerApplication(
    {
      user: {
        _id: userId(),
        institution: userId(),
        campus: userId(),
        isVerifiedStudent: true,
      },
      body: validApplicationBody,
    },
    res,
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /already awaiting review/i);
});

test("rejected applicants can resubmit and retain review history", async (context) => {
  const existing = {
    _id: userId(),
    status: "REJECTED",
    history: [
      { status: "PENDING" },
      { status: "REJECTED", reviewNote: "Please add contact details." },
    ],
  };
  const findOne = mock.method(SellerApplication, "findOne", async () => existing);
  const findOneAndUpdate = mock.method(
    SellerApplication,
    "findOneAndUpdate",
    async (_filter, update) => ({ status: update.$set.status, history: update.$set.history }),
  );
  context.after(() => {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  });
  const res = responseStub();

  await submitSellerApplication(
    {
      user: {
        _id: userId(),
        institution: userId(),
        campus: userId(),
        isVerifiedStudent: true,
      },
      body: validApplicationBody,
    },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.application.status, "PENDING");
  assert.equal(findOneAndUpdate.mock.calls[0].arguments[1].$set.history.length, 3);
});

test("administrators cannot approve their own seller applications", async (context) => {
  const adminId = userId();
  const application = {
    _id: userId(),
    seller: { _id: adminId },
    status: "PENDING",
    history: [],
  };
  const findOne = mock.method(SellerApplication, "findOne", () => ({
    populate: async () => application,
  }));
  context.after(() => findOne.mock.restore());
  const res = responseStub();

  await reviewSellerApplication(
    {
      params: { id: String(application._id) },
      user: { _id: adminId, institution: userId(), campus: userId() },
      body: { status: "APPROVED" },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /own seller applications/i);
});

test("seller application reviews require reasons for rejection", async () => {
  const res = responseStub();
  await reviewSellerApplication(
    {
      params: { id: String(userId()) },
      user: { _id: userId(), institution: userId(), campus: userId() },
      body: { status: "REJECTED", reviewNote: "" },
    },
    res,
  );
  assert.equal(res.statusCode, 400);
});
