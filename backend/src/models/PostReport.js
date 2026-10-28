import mongoose from "mongoose";

const postReportSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: ["spam", "harassment", "misinformation", "inappropriate", "other"],
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
      enum: ["OPEN", "REVIEWED", "DISMISSED"],
      default: "OPEN",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderationNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

postReportSchema.index({ post: 1, reporter: 1 }, { unique: true });
postReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("PostReport", postReportSchema);
