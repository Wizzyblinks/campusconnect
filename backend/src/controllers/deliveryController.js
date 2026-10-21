import crypto from "crypto";
import nodemailer from "nodemailer";

import Order from "../models/Order.js";
import { releaseSellerPayout } from "../services/payoutService.js";

const OTP_EXPIRY_MINUTES = 30;
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const sendDeliveryOtp = async (buyerEmail, otp, orderId) => {
  if (
    !process.env.MAIL_HOST ||
    !process.env.MAIL_USER ||
    !process.env.MAIL_PASS
  ) {
    throw new Error("Email delivery is not configured");
  }

  const port = Number(process.env.MAIL_PORT || 465);

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: buyerEmail,
    subject: "Your Campus Connect delivery verification code",
    text: [
      "Hello,",
      "",
      "Your order has been marked as delivered.",
      `Order reference: ${orderId}`,
      "",
      `Your delivery verification code is: ${otp}`,
      "",
      `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      "Do not share this code with the seller.",
      "",
      "If you have not received your order, do not provide the code.",
      "",
      "Campus Connect",
    ].join("\n"),
  });
};

const safeOrderResponse = (order) => ({
  id: order._id,
  status: order.status,
  paymentStatus: order.paymentStatus,
  deliveryStatus: order.deliveryStatus,
  sellerPayoutStatus: order.sellerPayoutStatus,
  sellerPayoutAmount: order.sellerPayoutAmount,
  platformCommission: order.platformCommission,
  deliveryMethod: order.deliveryMethod,
  completedAt: order.completedAt,
  deliveryOtpExpiresAt: order.deliveryOtpExpiresAt,
});

export const updateDeliveryStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "PROCESSING",
      "READY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid delivery status",
      });
    }

    const order = await Order.findById(req.params.orderId)
      .select("+deliveryOtpHash")
      .populate("buyer", "email name");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const isSeller = order.seller.toString() === req.user._id.toString();
    const isCampusMiddleman = req.user.role === "admin";

    if (
      (order.deliveryMethod === "SELLER_TO_BUYER" && !isSeller) ||
      (order.deliveryMethod === "MIDDLEMAN" && !isCampusMiddleman)
    ) {
      return res.status(403).json({
        message:
          order.deliveryMethod === "MIDDLEMAN"
            ? "Only an authorised Campus Connect middleman can update this delivery"
            : "Only the seller can update this delivery",
      });
    }

    if (order.paymentStatus !== "PAID") {
      return res.status(400).json({
        message: "Order must be paid before delivery can begin",
      });
    }

    if (
      ["DISPUTED", "CANCELLED", "REFUNDED", "COMPLETED"].includes(
        order.status,
      ) ||
      order.sellerPayoutStatus === "ON_HOLD" ||
      order.sellerPayoutStatus === "REFUNDED"
    ) {
      return res.status(400).json({
        message: "This order cannot be updated for delivery",
      });
    }

    const allowedTransitions = {
      PAID: ["PROCESSING"],
      PROCESSING: ["PROCESSING", "READY"],
      READY_FOR_DELIVERY: ["READY", "OUT_FOR_DELIVERY"],
      OUT_FOR_DELIVERY: ["OUT_FOR_DELIVERY", "DELIVERED"],
      DELIVERED: ["DELIVERED"],
    };

    const currentStatus = order.status;
    const allowedNextStatuses = allowedTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        message:
          "Cannot change delivery status from " +
          currentStatus +
          " to " +
          status,
      });
    }

    if (status === "DELIVERED") {
      order.deliveryStatus = "DELIVERED";
      order.status = "DELIVERED";

      await order.save();

      return res.json({
        message: "Delivery recorded. Ask the buyer for the verification code sent after payment.",
        order: safeOrderResponse(order),
      });
    }

    const orderStatusMap = {
      PROCESSING: "PROCESSING",
      READY: "READY_FOR_DELIVERY",
      OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    };

    order.deliveryStatus = status;
    order.status = orderStatusMap[status];

    await order.save();

    return res.json({
      message: "Delivery status updated successfully",
      order: safeOrderResponse(order),
    });
  } catch (error) {
    console.error("Update delivery status error:", error.message);

    return res.status(500).json({
      message: "Failed to update delivery status",
    });
  }
};

export const verifyDelivery = async (req, res) => {
  try {
    const { otp } = req.body;

    if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Enter the six-digit delivery OTP",
      });
    }

    const order = await Order.findById(req.params.orderId).select(
      "+deliveryOtpHash",
    );

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const isSeller = order.seller.toString() === req.user._id.toString();
    const isCampusMiddleman = req.user.role === "admin";

    if (
      (order.deliveryMethod === "SELLER_TO_BUYER" && !isSeller) ||
      (order.deliveryMethod === "MIDDLEMAN" && !isCampusMiddleman)
    ) {
      return res.status(403).json({
        message:
          order.deliveryMethod === "MIDDLEMAN"
            ? "Only an authorised Campus Connect middleman can verify this delivery"
            : "Only the seller can verify this delivery",
      });
    }

    if (
      ["DISPUTED", "CANCELLED", "REFUNDED"].includes(order.status) ||
      order.paymentStatus !== "PAID" ||
      order.sellerPayoutStatus === "ON_HOLD" ||
      order.sellerPayoutStatus === "REFUNDED"
    ) {
      return res.status(400).json({
        message: "This order cannot be completed",
      });
    }

    if (order.status === "COMPLETED") {
      return res.json({
        message: "Delivery has already been verified",
        order: safeOrderResponse(order),
      });
    }

    if (order.status !== "DELIVERED" || order.deliveryStatus !== "DELIVERED") {
      return res.status(400).json({
        message: "The order must be marked as delivered first",
      });
    }

    if (
      order.deliveryOtpLockedUntil &&
      order.deliveryOtpLockedUntil > new Date()
    ) {
      return res.status(429).json({
        message: "Too many incorrect attempts. Try again later.",
        retryAt: order.deliveryOtpLockedUntil,
      });
    }

    if (
      !order.deliveryOtpHash ||
      !order.deliveryOtpExpiresAt ||
      order.deliveryOtpExpiresAt <= new Date()
    ) {
      return res.status(400).json({
        message:
          "The delivery OTP has expired. Contact support for assistance.",
      });
    }

    const submittedHash = Buffer.from(hashOtp(otp), "hex");
    const storedHash = Buffer.from(order.deliveryOtpHash, "hex");

    const isValidOtp =
      submittedHash.length === storedHash.length &&
      crypto.timingSafeEqual(submittedHash, storedHash);

    if (!isValidOtp) {
      order.deliveryOtpAttempts = (order.deliveryOtpAttempts || 0) + 1;

      let attemptsRemaining;

      if (order.deliveryOtpAttempts >= MAX_OTP_ATTEMPTS) {
        order.deliveryOtpLockedUntil = new Date(
          Date.now() + OTP_LOCK_MINUTES * 60 * 1000,
        );

        order.deliveryOtpAttempts = 0;
        attemptsRemaining = 0;
      } else {
        attemptsRemaining = MAX_OTP_ATTEMPTS - order.deliveryOtpAttempts;
      }

      await order.save();

      return res.status(400).json({
        message: "Invalid delivery OTP",
        attemptsRemaining,
        lockedUntil: order.deliveryOtpLockedUntil,
      });
    }

    order.deliveryStatus = "VERIFIED";
    order.status = "COMPLETED";
    order.sellerPayoutStatus = "ELIGIBLE";
    order.completedAt = new Date();

    order.deliveryOtpHash = null;
    order.deliveryOtpExpiresAt = null;
    order.deliveryOtpAttempts = 0;
    order.deliveryOtpLockedUntil = null;

    await order.save();

    const payout = await releaseSellerPayout(order);

    return res.json({
      message:
        payout.status === "INITIATED"
          ? "Delivery verified and seller payout has been initiated."
          : "Delivery verified. The seller must add a verified payout account before funds can be transferred.",
      order: safeOrderResponse(order),
      payout: { status: payout.status, reference: payout.reference },
    });
  } catch (error) {
    console.error("Verify delivery error:", error.message);

    return res.status(500).json({
      message: "Failed to verify delivery",
    });
  }
};
