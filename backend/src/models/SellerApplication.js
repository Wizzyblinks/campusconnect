import mongoose from "mongoose";

const sellerApplicationSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    applicantName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    applicantPhone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
      default: "",
    },
    contactInfo: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    additionalInfo: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    categories: {
      type: [{ type: String, enum: ["electronics", "fashion", "books", "food", "services", "school_items", "others"] }],
      required: true,
      validate: {
        validator: (categories) => categories.length > 0,
        message: "Select at least one product category",
      },
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
      default: "PENDING",
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    history: [
      {
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
          required: true,
        },
        businessName: { type: String, trim: true, maxlength: 100, default: "" },
        applicantName: { type: String, trim: true, maxlength: 80, default: "" },
        applicantPhone: { type: String, trim: true, maxlength: 30, default: "" },
        contactEmail: { type: String, lowercase: true, trim: true, maxlength: 254, default: "" },
        contactInfo: { type: String, trim: true, maxlength: 120, default: "" },
        additionalInfo: { type: String, trim: true, maxlength: 1000, default: "" },
        categories: [{ type: String }],
        description: { type: String, trim: true, maxlength: 1000, default: "" },
        reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    lastSubmittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

sellerApplicationSchema.index({ institution: 1, campus: 1, status: 1, createdAt: -1 });

export default mongoose.model("SellerApplication", sellerApplicationSchema);
