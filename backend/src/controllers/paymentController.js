import crypto from "crypto";
import nodemailer from "nodemailer";

import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import MarketplaceListing from "../models/MarketplaceListing.js";

const PAYSTACK_API = "https://api.paystack.co";
const OTP_EXPIRY_MINUTES = 30;

const sendBuyerDeliveryOtp = async (email, otp, orderId) => {
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error("Email delivery is not configured");
  }
  const port = Number(process.env.MAIL_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: email,
    subject: "Your Campus Connect delivery verification code",
    text: `Your order ${orderId} was paid for. Your delivery verification code is ${otp}. Share it only after you receive your item. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
  });
};

const getPaystackHeaders = () => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
};

const paystackRequest = async (endpoint, options = {}) => {
  const response = await fetch(`${PAYSTACK_API}${endpoint}`, {
    ...options,
    headers: {
      ...getPaystackHeaders(),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.status) {
    throw new Error(data.message || "Paystack request failed");
  }

  return data.data;
};

export const initializePayment = async (req, res) => {
  try {
    const { orderId, callbackUrl } = req.body;

    if (!orderId) {
      return res.status(400).json({
        message: "Order ID is required",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the buyer can pay for this order",
      });
    }

    if (order.paymentStatus === "PAID" || order.status === "COMPLETED") {
      return res.status(400).json({
        message: "This order has already been paid for",
      });
    }

    if (
      order.status !== "PENDING_PAYMENT" ||
      order.paymentStatus !== "PENDING"
    ) {
      return res.status(400).json({
        message: "This order is not eligible for payment",
      });
    }

    if (!Number.isFinite(order.totalAmount) || order.totalAmount <= 0) {
      return res.status(400).json({
        message: "Invalid order amount",
      });
    }

    const amountInKobo = Math.round(order.totalAmount * 100);

    if (!Number.isSafeInteger(amountInKobo) || amountInKobo <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount",
      });
    }

    let payment = await Payment.findOne({
      order: order._id,
    });

    if (payment?.status === "SUCCESS") {
      return res.status(400).json({
        message: "This order already has a successful payment",
      });
    }

    if (payment?.provider === "PAYSTACK" && payment.authorizationUrl) {
      return res.json({
        message: "Payment already initialized",
        payment: {
          reference: payment.reference,
          authorizationUrl: payment.authorizationUrl,
          accessCode: payment.accessCode,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
        },
      });
    }

    const reference = `CC-${crypto.randomUUID()}`;

    const safeCallbackUrl =
      typeof callbackUrl === "string" && /^https?:\/\//i.test(callbackUrl)
        ? callbackUrl
        : undefined;

    const checkout = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: req.user.email,
        amount: amountInKobo,
        currency: "NGN",
        reference,
        metadata: {
          orderId: order._id.toString(),
          buyerId: req.user._id.toString(),
        },
        ...(safeCallbackUrl ? { callback_url: safeCallbackUrl } : {}),
      }),
    });

    if (payment) {
      payment.reference = reference;
      payment.provider = "PAYSTACK";
      payment.amount = order.totalAmount;
      payment.currency = "NGN";
      payment.status = "PENDING";
      payment.authorizationUrl = checkout.authorization_url;
      payment.accessCode = checkout.access_code;

      await payment.save();
    } else {
      payment = await Payment.create({
        order: order._id,
        buyer: req.user._id,
        amount: order.totalAmount,
        currency: "NGN",
        reference,
        provider: "PAYSTACK",
        authorizationUrl: checkout.authorization_url,
        accessCode: checkout.access_code,
      });
    }

    return res.status(201).json({
      message: "Payment initialized successfully",
      payment: {
        reference: payment.reference,
        authorizationUrl: payment.authorizationUrl,
        accessCode: payment.accessCode,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Payment initialization error:", error.message);

    return res.status(500).json({
      message: "Failed to initialize payment",
      error: error.message,
    });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        message: "Payment reference is required",
      });
    }

    const payment = await Payment.findOne({
      reference,
      provider: "PAYSTACK",
    });

    if (!payment) {
      return res.status(404).json({
        message: "Paystack payment not found",
      });
    }

    if (payment.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to confirm this payment",
      });
    }

    const order = await Order.findById(payment.order);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (payment.status === "SUCCESS" && order.paymentStatus === "PAID") {
      return res.json({
        message: "Payment has already been confirmed",
        payment: {
          reference: payment.reference,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
        },
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      });
    }

    if (order.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        message: "This order is not awaiting payment",
      });
    }

    const transaction = await paystackRequest(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
      },
    );

    const expectedAmount = Math.round(payment.amount * 100);

    if (
      transaction.status !== "success" ||
      transaction.reference !== payment.reference ||
      transaction.amount !== expectedAmount ||
      transaction.currency !== payment.currency
    ) {
      return res.status(400).json({
        message: "Payment could not be verified",
      });
    }

    const listing = await MarketplaceListing.findOneAndUpdate(
      {
        _id: order.listing,
        status: "active",
        stock: { $gte: order.quantity },
      },
      {
        $inc: {
          stock: -order.quantity,
        },
      },
      {
        new: true,
      },
    );

    if (!listing) {
      payment.status = "SUCCESS";
      payment.paidAt = transaction.paid_at
        ? new Date(transaction.paid_at)
        : new Date();

      await payment.save();

      return res.status(409).json({
        message:
          "Payment succeeded, but the item is no longer available. The order requires refund or administrative review.",
        paymentStatus: payment.status,
      });
    }

    if (listing.stock === 0) {
      listing.status = "sold";
      await listing.save();
    }

    payment.status = "SUCCESS";
    payment.paidAt = transaction.paid_at
      ? new Date(transaction.paid_at)
      : new Date();

    order.paymentStatus = "PAID";
    order.status = "PAID";
    const otp = crypto.randomInt(100000, 1000000).toString();
    order.deliveryOtpHash = crypto.createHash("sha256").update(otp).digest("hex");
    order.deliveryOtpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    order.deliveryOtpAttempts = 0;
    order.deliveryOtpLockedUntil = null;

    await payment.save();
    await order.save();

    try {
      await sendBuyerDeliveryOtp(req.user.email, otp, order._id.toString());
    } catch (emailError) {
      console.error("Payment OTP email failed:", emailError.message);
    }

    return res.json({
      message: "Payment verified successfully",
      payment: {
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
      },
      order: {
        id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error.message);

    return res.status(500).json({
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

export const getPaymentByOrder = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      order: req.params.orderId,
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    if (payment.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to view this payment",
      });
    }

    return res.json({
      payment: {
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch payment",
      error: error.message,
    });
  }
};
