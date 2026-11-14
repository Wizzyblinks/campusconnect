import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
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
      enum: ["PENDING", "PROCESSING", "SUCCESS", "REFUND_PENDING", "REFUNDED", "FAILED"],
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

    providerTransactionId: {
      type: String,
      default: null,
    },

    providerReference: {
      type: String,
      default: null,
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

    refundProviderId: {
      type: String,
      default: "",
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

    verificationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },

    failedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index(
  { provider: 1, providerReference: 1 },
  { unique: true, partialFilterExpression: { providerReference: { $type: "string" } } },
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
