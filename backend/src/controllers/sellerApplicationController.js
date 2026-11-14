import mongoose from "mongoose";
import SellerApplication from "../models/SellerApplication.js";
import User from "../models/User.js";
import { getSellerEligibility } from "../services/sellerEligibility.js";

const categories = new Set([
  "electronics",
  "fashion",
  "books",
  "food",
  "services",
  "school_items",
  "others",
]);

const buildApplicationSnapshot = (
  application,
  status,
  changedBy,
  reviewNote = "",
  changedAt = new Date(),
) => ({
  status,
  businessName: application.businessName,
  applicantName: application.applicantName,
  applicantPhone: application.applicantPhone,
  contactEmail: application.contactEmail,
  contactInfo: application.contactInfo,
  additionalInfo: application.additionalInfo,
  categories: application.categories,
  description: application.description,
  reviewNote,
  changedBy: changedBy || null,
  changedAt,
});

export const getSellerApplicationStatus = async (req, res) => {
  try {
    const eligibility = await getSellerEligibility(req.user._id);
    return res.json({
      eligible: eligibility.eligible,
      legacySeller: eligibility.legacySeller,
      application: eligibility.application,
    });
  } catch (error) {
    console.error("Seller status lookup failed:", error.message);
    return res.status(500).json({ message: "Could not load seller status." });
  }
};

export const submitSellerApplication = async (req, res) => {
  const {
    businessName,
    applicantName,
    applicantPhone,
    contactEmail,
    contactInfo = "",
    additionalInfo = "",
    categories: submittedCategories,
    description,
  } = req.body || {};
  const normalizedName = typeof businessName === "string" ? businessName.trim() : "";
  const normalizedApplicantName = typeof applicantName === "string" ? applicantName.trim() : "";
  const normalizedPhone = typeof applicantPhone === "string" ? applicantPhone.trim() : "";
  const normalizedContactEmail = typeof contactEmail === "string" ? contactEmail.trim().toLowerCase() : "";
  const normalizedContactInfo = typeof contactInfo === "string" ? contactInfo.trim() : null;
  const normalizedAdditionalInfo = typeof additionalInfo === "string" ? additionalInfo.trim() : null;
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const normalizedCategories = Array.isArray(submittedCategories)
    ? [...new Set(submittedCategories)]
    : [];

  if (
    Object.keys(req.body || {}).some((field) => ![
      "businessName",
      "applicantName",
      "applicantPhone",
      "contactEmail",
      "contactInfo",
      "additionalInfo",
      "categories",
      "description",
    ].includes(field)) ||
    normalizedName.length < 2 ||
    normalizedName.length > 100 ||
    normalizedApplicantName.length < 2 ||
    normalizedApplicantName.length > 80 ||
    normalizedPhone.length < 7 ||
    normalizedPhone.length > 30 ||
    (normalizedPhone.match(/\d/g) || []).length < 7 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactEmail) ||
    normalizedContactEmail.length > 254 ||
    normalizedContactInfo === null ||
    normalizedContactInfo.length > 120 ||
    normalizedAdditionalInfo === null ||
    normalizedAdditionalInfo.length > 1000 ||
    normalizedDescription.length < 20 ||
    normalizedDescription.length > 1000 ||
    normalizedCategories.length === 0 ||
    normalizedCategories.some((category) => !categories.has(category))
  ) {
    return res.status(400).json({
      message: "Provide valid applicant and contact details, a business name, at least one product category, and a description of 20 to 1,000 characters.",
    });
  }

  if (!req.user.isVerifiedStudent) {
    return res.status(403).json({
      message: "Student verification is required to apply as a seller.",
    });
  }

  try {
    const existing = await SellerApplication.findOne({ seller: req.user._id });
    if (existing?.status === "SUSPENDED") {
      return res.status(403).json({ message: "Suspended seller accounts cannot reapply." });
    }
    if (existing?.status === "PENDING" || existing?.status === "APPROVED") {
      return res.status(409).json({
        message: existing.status === "PENDING"
          ? "Your seller application is already awaiting review."
          : "Your seller account is already approved.",
      });
    }

    const applicationFields = {
      institution: req.user.institution,
      campus: req.user.campus,
      businessName: normalizedName,
      applicantName: normalizedApplicantName,
      applicantPhone: normalizedPhone,
      contactEmail: normalizedContactEmail,
      contactInfo: normalizedContactInfo,
      additionalInfo: normalizedAdditionalInfo,
      categories: normalizedCategories,
      description: normalizedDescription,
    };
    const submittedAt = new Date();
    const pendingHistory = {
      ...applicationFields,
      status: "PENDING",
      reviewNote: "",
      changedBy: req.user._id,
      changedAt: submittedAt,
    };
    let application;
    if (existing) {
      const history = [...(existing.history || [])];
      if (history.length === 0 || history[history.length - 1].status !== "REJECTED") {
        history.push(buildApplicationSnapshot(
          existing,
          existing.status,
          existing.reviewedBy,
          existing.reviewNote,
          existing.reviewedAt || existing.updatedAt || existing.createdAt,
        ));
      }
      history.push(pendingHistory);
      application = await SellerApplication.findOneAndUpdate(
        { _id: existing._id, status: "REJECTED" },
        {
          $set: {
            ...applicationFields,
            status: "PENDING",
            reviewNote: "",
            reviewedBy: null,
            reviewedAt: null,
            lastSubmittedAt: submittedAt,
            history,
          },
        },
        { new: true, runValidators: true },
      );
      if (!application) {
        return res.status(409).json({ message: "Your application status changed. Refresh and try again." });
      }
    } else {
      application = new SellerApplication({
        seller: req.user._id,
        ...applicationFields,
        lastSubmittedAt: submittedAt,
        history: [pendingHistory],
      });
      try {
        await application.save();
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(409).json({ message: "A seller application already exists for your account." });
        }
        throw error;
      }
    }

    return res.status(201).json({
      message: "Seller application submitted for campus review.",
      application,
      eligible: false,
    });
  } catch (error) {
    console.error("Seller application submission failed:", error.message);
    return res.status(500).json({ message: "Could not submit your seller application." });
  }
};

export const getSellerApplicationsForAdmin = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const status = req.query.status || "PENDING";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (
    Object.keys(req.body || {}).some((field) => !["status", "reviewNote"].includes(field)) ||
    !Number.isInteger(page) || page < 1 ||
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "ALL"].includes(status) ||
    search.length > 100
  ) {
    return res.status(400).json({ message: "Invalid seller application filters." });
  }
  try {
    const filter = {
      institution: req.user.institution,
      campus: req.user.campus,
      ...(status === "ALL" ? {} : { status }),
    };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      const matchingUsers = await User.find({
        institution: req.user.institution,
        campus: req.user.campus,
        $or: [
          { name: searchRegex },
          { username: searchRegex },
          { email: searchRegex },
        ],
      }).distinct("_id");
      filter.$or = [
        { businessName: searchRegex },
        { applicantName: searchRegex },
        ...(matchingUsers.length ? [{ seller: { $in: matchingUsers } }] : []),
      ];
    }
    const [applications, total, groupedCounts] = await Promise.all([
      SellerApplication.find(filter)
        .populate("seller", "name username email profile.avatar isVerifiedStudent isRestricted")
        .populate("reviewedBy", "name")
        .populate("history.changedBy", "name")
        .sort({ lastSubmittedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SellerApplication.countDocuments(filter),
      SellerApplication.aggregate([
        {
          $match: {
            institution: new mongoose.Types.ObjectId(String(req.user.institution)),
            campus: new mongoose.Types.ObjectId(String(req.user.campus)),
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
    groupedCounts.forEach(({ _id, count }) => {
      if (Object.hasOwn(counts, _id)) counts[_id] = count;
    });
    return res.json({
      applications,
      counts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Admin seller application lookup failed:", error.message);
    return res.status(500).json({ message: "Could not load seller applications." });
  }
};

export const reviewSellerApplication = async (req, res) => {
  const { status, reviewNote = "" } = req.body || {};
  if (
    !["APPROVED", "REJECTED", "SUSPENDED"].includes(status) ||
    typeof reviewNote !== "string" ||
    reviewNote.trim().length > 500 ||
    (status !== "APPROVED" && reviewNote.trim().length < 5)
  ) {
    return res.status(400).json({ message: "Provide a valid seller application decision and review note." });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Seller application not found." });
  }
  try {
    const application = await SellerApplication.findOne({
      _id: req.params.id,
      institution: req.user.institution,
      campus: req.user.campus,
    }).populate("seller", "name username email profile.avatar isVerifiedStudent isRestricted");
    if (!application) {
      return res.status(404).json({ message: "Seller application not found." });
    }
    const sellerId = application.seller?._id || application.seller;
    if (status === "APPROVED" && String(sellerId) === String(req.user._id)) {
      return res.status(403).json({ message: "Administrators cannot approve their own seller applications." });
    }
    const allowedTransition =
      (application.status === "PENDING" && ["APPROVED", "REJECTED"].includes(status)) ||
      (application.status === "APPROVED" && status === "SUSPENDED");
    if (!allowedTransition) {
      return res.status(409).json({ message: "This seller application can no longer be reviewed in its current state." });
    }
    if (status === "APPROVED" && (
      !application.seller ||
      !application.seller.isVerifiedStudent ||
      application.seller.isRestricted
    )) {
      return res.status(403).json({ message: "Only an unrestricted, verified student can be approved as a seller." });
    }
    const historyEntries = [];
    if (application.history.length === 0) {
      historyEntries.push(buildApplicationSnapshot(
        application,
        "PENDING",
        null,
        "",
        application.lastSubmittedAt || application.createdAt,
      ));
    }
    historyEntries.push(buildApplicationSnapshot(
      application,
      status,
      req.user._id,
      reviewNote.trim(),
    ));
    const reviewedAt = new Date();
    const updatedApplication = await SellerApplication.findOneAndUpdate(
      {
        _id: application._id,
        institution: req.user.institution,
        campus: req.user.campus,
        status: application.status,
      },
      {
        $set: {
          status,
          reviewNote: reviewNote.trim(),
          reviewedBy: req.user._id,
          reviewedAt,
        },
        $push: { history: { $each: historyEntries } },
      },
      { new: true, runValidators: true },
    ).populate("seller", "name username email profile.avatar isVerifiedStudent isRestricted");
    if (!updatedApplication) {
      return res.status(409).json({ message: "This seller application was already reviewed. Refresh and try again." });
    }
    return res.json({
      message: `Seller application ${status.toLowerCase()}.`,
      application: updatedApplication,
    });
  } catch (error) {
    console.error("Seller application review failed:", error.message);
    return res.status(500).json({ message: "Could not update seller application." });
  }
};
