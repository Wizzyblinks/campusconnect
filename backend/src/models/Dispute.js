import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    evidence: [
      {
        type: String,
      },
    ],

    status: {
      type: String,
      enum: [
        "OPEN",
        "UNDER_REVIEW",
        "RESOLVED_BUYER",
        "RESOLVED_SELLER",
        "CLOSED",
      ],
      default: "OPEN",
    },

    resolutionNote: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Dispute = mongoose.model("Dispute", disputeSchema);

export default Dispute;
