import crypto from "crypto";
import Payout from "../models/Payout.js";

export async function listNigerianBanks() {
  const error = new Error(
    "Seller bank verification is temporarily unavailable while Flutterwave transfers are configured.",
  );
  error.statusCode = 503;
  throw error;
}

export async function saveSellerPayoutAccount() {
  const error = new Error(
    "New seller payout accounts cannot be added until Flutterwave transfer permissions are enabled.",
  );
  error.statusCode = 503;
  throw error;
}

export async function releaseSellerPayout(order) {
  const existing = await Payout.findOne({ order: order._id });
  if (existing) return existing;

  const payout = await Payout.create({
    order: order._id,
    seller: order.seller,
    amount: order.sellerPayoutAmount,
    reference: `CC-MANUAL-PAYOUT-${crypto.randomUUID()}`,
    provider: "MANUAL",
    status: "PENDING_MANUAL",
    failureReason:
      "Delivery was verified. Flutterwave transfers are not enabled; an administrator must complete and record the payout manually.",
  });
  order.sellerPayoutStatus = "ELIGIBLE";
  await order.save();
  return payout;
}
