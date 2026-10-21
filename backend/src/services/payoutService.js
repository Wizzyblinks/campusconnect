import crypto from "crypto";
import Payout from "../models/Payout.js";
import User from "../models/User.js";

const PAYSTACK_API = "https://api.paystack.co";

async function paystackRequest(endpoint, options = {}) {
  const response = await fetch(`${PAYSTACK_API}${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.status) throw new Error(body.message || "Paystack request failed");
  return body.data;
}

export async function listNigerianBanks() {
  return paystackRequest("/bank?country=nigeria&currency=NGN");
}

export async function saveSellerPayoutAccount(user, { accountNumber, bankCode }) {
  if (!/^\d{10}$/.test(accountNumber || "") || !bankCode) {
    throw new Error("Enter a valid 10-digit Nigerian account number and bank");
  }
  const resolved = await paystackRequest(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
  const recipient = await paystackRequest("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({ type: "nuban", name: resolved.account_name, account_number: accountNumber, bank_code: bankCode, currency: "NGN" }),
  });
  user.payoutAccount = {
    accountName: resolved.account_name,
    accountLast4: accountNumber.slice(-4),
    bankCode,
    bankName: recipient.details?.bank_name || "",
    recipientCode: recipient.recipient_code,
    verifiedAt: new Date(),
  };
  await user.save();
  return user.payoutAccount;
}

export async function releaseSellerPayout(order) {
  const existing = await Payout.findOne({ order: order._id });
  if (["SUCCESS", "INITIATED", "PENDING"].includes(existing?.status)) return existing;

  const seller = await User.findById(order.seller);
  const reference = existing?.reference || `CC-PAYOUT-${crypto.randomUUID()}`;
  let payout = existing || (await Payout.create({ order: order._id, seller: order.seller, amount: order.sellerPayoutAmount, reference, status: "PENDING" }));

  if (!seller?.payoutAccount?.recipientCode) {
    payout.status = "PENDING_BANK_DETAILS";
    payout.failureReason = "Seller has not added a verified payout account";
    await payout.save();
    order.sellerPayoutStatus = "PENDING";
    await order.save();
    return payout;
  }

  try {
    const transfer = await paystackRequest("/transfer", {
      method: "POST",
      body: JSON.stringify({ source: "balance", amount: Math.round(order.sellerPayoutAmount * 100), recipient: seller.payoutAccount.recipientCode, reason: `Campus Connect order ${order._id}`, reference }),
    });
    payout.status = "INITIATED";
    payout.recipientCode = seller.payoutAccount.recipientCode;
    payout.transferCode = transfer.transfer_code || "";
    payout.failureReason = "";
    order.sellerPayoutStatus = "ELIGIBLE";
  } catch (error) {
    payout.status = "FAILED";
    payout.failureReason = error.message;
    order.sellerPayoutStatus = "ELIGIBLE";
  }
  await payout.save();
  await order.save();
  return payout;
}
