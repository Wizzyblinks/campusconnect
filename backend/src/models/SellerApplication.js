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
  },
  { timestamps: true },
);

sellerApplicationSchema.index({ institution: 1, campus: 1, status: 1, createdAt: -1 });

export default mongoose.model("SellerApplication", sellerApplicationSchema);
