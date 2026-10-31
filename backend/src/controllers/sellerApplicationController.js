import mongoose from "mongoose";
import SellerApplication from "../models/SellerApplication.js";
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
  const { businessName, categories: submittedCategories, description } = req.body;
  const normalizedName = typeof businessName === "string" ? businessName.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const normalizedCategories = Array.isArray(submittedCategories)
    ? [...new Set(submittedCategories)]
    : [];

  if (
    normalizedName.length < 2 ||
    normalizedName.length > 100 ||
    normalizedDescription.length < 20 ||
    normalizedDescription.length > 1000 ||
    normalizedCategories.length === 0 ||
    normalizedCategories.some((category) => !categories.has(category))
  ) {
    return res.status(400).json({
      message: "Provide a business name, at least one valid category, and a description of 20 to 1,000 characters.",
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

    const application = existing
      ? Object.assign(existing, {
        institution: req.user.institution,
        campus: req.user.campus,
        businessName: normalizedName,
        categories: normalizedCategories,
        description: normalizedDescription,
        status: "PENDING",
        reviewNote: "",
        reviewedBy: null,
        reviewedAt: null,
      })
      : new SellerApplication({
        seller: req.user._id,
        institution: req.user.institution,
        campus: req.user.campus,
        businessName: normalizedName,
        categories: normalizedCategories,
        description: normalizedDescription,
      });
    await application.save();

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
  if (
    !Number.isInteger(page) || page < 1 ||
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "ALL"].includes(status)
  ) {
    return res.status(400).json({ message: "Invalid seller application filters." });
  }
  try {
    const filter = {
      institution: req.user.institution,
      campus: req.user.campus,
      ...(status === "ALL" ? {} : { status }),
    };
    const [applications, total] = await Promise.all([
      SellerApplication.find(filter)
        .populate("seller", "name email profile.avatar isVerifiedStudent isRestricted")
        .populate("reviewedBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SellerApplication.countDocuments(filter),
    ]);
    return res.json({
      applications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Admin seller application lookup failed:", error.message);
    return res.status(500).json({ message: "Could not load seller applications." });
  }
};

export const reviewSellerApplication = async (req, res) => {
  const { status, reviewNote = "" } = req.body;
  if (
    !["APPROVED", "REJECTED", "SUSPENDED"].includes(status) ||
    typeof reviewNote !== "string" ||
    reviewNote.trim().length > 500
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
    }).populate("seller", "name email profile.avatar isVerifiedStudent isRestricted");
    if (!application) {
      return res.status(404).json({ message: "Seller application not found." });
    }
    if (status === "APPROVED" && (!application.seller.isVerifiedStudent || application.seller.isRestricted)) {
      return res.status(403).json({ message: "Only an unrestricted, verified student can be approved as a seller." });
    }
    application.status = status;
    application.reviewNote = reviewNote.trim();
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();
    return res.json({
      message: `Seller application ${status.toLowerCase()}.`,
      application,
    });
  } catch (error) {
    console.error("Seller application review failed:", error.message);
    return res.status(500).json({ message: "Could not update seller application." });
  }
};
