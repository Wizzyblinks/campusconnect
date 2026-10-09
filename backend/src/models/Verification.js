import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    documentUrl: {
      type: String,
      required: true,
    },

    documentType: {
      type: String,
      enum: ["student_id", "admission_letter", "school_fee_receipt"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "manual_review"],
      default: "pending",
    },

    aiConfidence: {
      type: Number,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Verification = mongoose.model("Verification", verificationSchema);

export default Verification;
