import mongoose from "mongoose";
import { campusServiceCategories } from "./CampusService.js";

const serviceRequestSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, enum: campusServiceCategories },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    provider: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    priceArrangement: { type: String, trim: true, maxlength: 200, default: "Contact provider" },
    availability: { type: String, trim: true, maxlength: 160, default: "Contact provider" },
    imageUrl: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, select: false, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "CampusService", default: null },
  },
  { timestamps: true },
);

serviceRequestSchema.index(
  { requester: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } },
);
serviceRequestSchema.index({ institution: 1, campus: 1, status: 1, createdAt: -1 });

export default mongoose.model("ServiceRequest", serviceRequestSchema);
