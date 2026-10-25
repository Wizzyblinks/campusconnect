import mongoose from "mongoose";

const vibeCheckReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: ["HARASSMENT", "SPAM", "IMPERSONATION", "INAPPROPRIATE", "OTHER"],
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"],
      default: "OPEN",
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
  },
  { timestamps: true },
);

vibeCheckReportSchema.index({ status: 1, createdAt: -1 });

const VibeCheckReport = mongoose.model(
  "VibeCheckReport",
  vibeCheckReportSchema,
);

export default VibeCheckReport;
