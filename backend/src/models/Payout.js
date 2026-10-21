import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String, required: true, unique: true },
    recipientCode: { type: String, default: "" },
    transferCode: { type: String, default: "" },
    status: { type: String, enum: ["PENDING_BANK_DETAILS", "PENDING", "INITIATED", "SUCCESS", "FAILED"], default: "PENDING" },
    failureReason: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("Payout", payoutSchema);
