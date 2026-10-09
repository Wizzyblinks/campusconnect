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
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },

    deliveryStatus: {
      type: String,
      enum: ["PENDING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "VERIFIED"],
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

    deliveryOtp: {
      type: String,
      default: null,
    },

    deliveryOtpExpiresAt: {
      type: Date,
      default: null,
    },

    sellerPayoutStatus: {
      type: String,
      enum: ["PENDING", "RELEASED", "REFUNDED"],
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
