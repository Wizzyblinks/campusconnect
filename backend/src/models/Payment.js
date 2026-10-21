import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "NGN",
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "REFUND_PENDING", "REFUNDED", "FAILED"],
      default: "PENDING",
    },

    reference: {
      type: String,
      required: true,
      unique: true,
    },

    provider: {
      type: String,
      enum: ["TEST", "PAYSTACK", "FLUTTERWAVE"],
      default: "PAYSTACK",
    },

    authorizationUrl: {
      type: String,
      default: null,
    },

    accessCode: {
      type: String,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundId: {
      type: Number,
      default: null,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundStatus: {
      type: String,
      enum: ["PENDING", "PROCESSED", "FAILED"],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
