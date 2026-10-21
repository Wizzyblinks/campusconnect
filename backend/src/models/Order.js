import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
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

    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryMethod: {
      type: String,
      enum: ["MIDDLEMAN", "SELLER_TO_BUYER"],
      required: true,
    },

    deliveryFee: { type: Number, required: true, min: 0, default: 0 },

    platformCommissionRate: { type: Number, required: true, default: 0.07 },

    platformCommission: { type: Number, required: true, min: 0, default: 0 },

    sellerPayoutAmount: { type: Number, required: true, min: 0, default: 0 },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAID",
        "PROCESSING",
        "READY_FOR_DELIVERY",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
        "REFUNDED",
      ],
      default: "PENDING_PAYMENT",
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUND_PENDING", "REFUNDED"],
      default: "PENDING",
    },

    deliveryStatus: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "READY",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "VERIFIED",
      ],
      default: "PENDING",
    },

    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },

    deliveryPhone: {
      type: String,
      required: true,
      trim: true,
    },

    buyerNote: {
      type: String,
      default: "",
      maxlength: 500,
    },

    deliveryOtpHash: {
      type: String,
      default: null,
      select: false,
    },

    deliveryOtpExpiresAt: {
      type: Date,
      default: null,
    },

    deliveryOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryOtpLockedUntil: {
      type: Date,
      default: null,
    },

    sellerPayoutStatus: {
      type: String,
      enum: ["PENDING", "ELIGIBLE", "ON_HOLD", "RELEASED", "REFUNDED"],
      default: "PENDING",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
