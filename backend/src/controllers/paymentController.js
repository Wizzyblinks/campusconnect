import crypto from "crypto";
import nodemailer from "nodemailer";

import MarketplaceListing from "../models/MarketplaceListing.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import {
  initializeFlutterwaveCheckout,
  isValidFlutterwaveWebhook,
  verifyFlutterwaveTransaction,
} from "../services/flutterwaveService.js";

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

const safePayment = (payment) => ({
  id: payment._id,
  order: payment.order,
  reference: payment.reference,
  providerReference: payment.providerReference || payment.reference,
  providerTransactionId: payment.providerTransactionId,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  provider: payment.provider || "PAYSTACK",
  paidAt: payment.paidAt,
  refundAmount: payment.refundAmount,
  refundStatus: payment.refundStatus,
  createdAt: payment.createdAt,
});

export const validateFlutterwaveTransaction = ({ transaction, payment, buyer }) => {
  const normalizedCurrency = String(transaction?.currency || "").toUpperCase();
  const actualAmount = Number(transaction?.amount);
  const expectedAmount = Number(payment.amount);
  const transactionId = String(transaction?.id || "");

  if (
    !transactionId ||
    (payment.providerTransactionId &&
      String(payment.providerTransactionId) !== transactionId) ||
    transaction.tx_ref !== (payment.providerReference || payment.reference) ||
    !Number.isFinite(actualAmount) ||
    Math.round(actualAmount * 100) !== Math.round(expectedAmount * 100) ||
    normalizedCurrency !== String(payment.currency || "NGN").toUpperCase() ||
    String(transaction.customer?.email || "").trim().toLowerCase() !==
      String(buyer.email || "").trim().toLowerCase()
  ) {
    return false;
  }
  return true;
};

const finishSuccessfulPayment = async ({ payment, transaction, buyer }) => {
  if (payment.status === "SUCCESS") {
    const paidOrder = await Order.findById(payment.order);
    return {
      alreadyProcessed: true,
      payment,
      order: paidOrder,
    };
  }
  if (payment.status === "PROCESSING") {
    return { alreadyProcessing: true, payment };
  }
  if (payment.status !== "PENDING") {
    return { rejected: true, payment };
  }

  const claimedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "PENDING" },
    {
      $set: {
        status: "PROCESSING",
        providerTransactionId: String(transaction.id),
        verificationDetails: {
          status: transaction.status,
          amount: Number(transaction.amount),
          currency: String(transaction.currency || "").toUpperCase(),
          verifiedAt: new Date(),
        },
      },
    },
    { new: true },
  );
  if (!claimedPayment) {
    const latest = await Payment.findById(payment._id);
    return {
      alreadyProcessed: latest?.status === "SUCCESS",
      alreadyProcessing: latest?.status === "PROCESSING",
      payment: latest || payment,
      order: latest?.status === "SUCCESS"
        ? await Order.findById(payment.order)
        : null,
    };
  }

  const order = await Order.findOne({
    _id: payment.order,
    buyer: payment.buyer,
    paymentStatus: "PENDING",
    status: "PENDING_PAYMENT",
  });
  if (!order) {
    claimedPayment.status = "SUCCESS";
    claimedPayment.paidAt = transaction.created_at
      ? new Date(transaction.created_at)
      : new Date();
    await claimedPayment.save();
    return { payment: claimedPayment, order: null, orderNeedsReview: true };
  }

  const listing = await MarketplaceListing.findOneAndUpdate(
    {
      _id: order.listing,
      status: "active",
      stock: { $gte: order.quantity },
    },
    { $inc: { stock: -order.quantity } },
    { new: true },
  );

  const paidAt = transaction.created_at
    ? new Date(transaction.created_at)
    : new Date();
  const otp = crypto.randomInt(100000, 1000000).toString();
  const deliveryOtpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const updatedOrder = listing
    ? await Order.findOneAndUpdate(
      {
        _id: order._id,
        buyer: payment.buyer,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
      },
      {
        $set: {
          paymentStatus: "PAID",
          status: "PAID",
          deliveryOtpHash,
          deliveryOtpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
          deliveryOtpAttempts: 0,
          deliveryOtpLockedUntil: null,
        },
      },
      { new: true },
    )
    : null;

  if (listing && !updatedOrder) {
    await MarketplaceListing.updateOne(
      { _id: listing._id },
      { $inc: { stock: order.quantity }, $set: { status: "active" } },
    );
  }
  if (listing?.stock === 0 && updatedOrder) {
    await MarketplaceListing.updateOne(
      { _id: listing._id, stock: 0 },
      { $set: { status: "sold" } },
    );
  }

  claimedPayment.status = "SUCCESS";
  claimedPayment.paidAt = paidAt;
  await claimedPayment.save();

  if (!listing || !updatedOrder) {
    return {
      payment: claimedPayment,
      order: updatedOrder || order,
      orderNeedsReview: true,
    };
  }

  try {
    await sendBuyerDeliveryOtp(buyer.email, otp, order._id.toString());
  } catch (emailError) {
    console.error("Payment OTP email failed:", emailError.message);
  }

  return { payment: claimedPayment, order: updatedOrder };
};

const verifyAndProcessFlutterwavePayment = async ({
  reference,
  transactionId,
  buyerId,
}) => {
  const payment = await Payment.findOne({
    reference,
    provider: "FLUTTERWAVE",
  });
  if (!payment) return { status: 404, message: "Flutterwave payment not found." };
  if (String(payment.buyer) !== String(buyerId)) {
    return { status: 403, message: "You are not authorized to confirm this payment." };
  }
  if (payment.status === "SUCCESS") {
    return {
      status: 200,
      message: "Payment has already been confirmed.",
      payment: safePayment(payment),
      order: await Order.findById(payment.order),
    };
  }
  if (payment.status === "PROCESSING") {
    return { status: 202, message: "Payment verification is already in progress." };
  }
  if (payment.status !== "PENDING") {
    return { status: 409, message: "This payment attempt is no longer active." };
  }

  const buyer = await User.findById(payment.buyer).select("email");
  if (!buyer) return { status: 404, message: "Payment customer not found." };

  const transaction = await verifyFlutterwaveTransaction(transactionId);
  if (!validateFlutterwaveTransaction({ transaction, payment, buyer })) {
    return { status: 400, message: "Payment could not be verified against this order." };
  }

  const providerStatus = String(transaction.status || "").toLowerCase();
  if (providerStatus !== "successful") {
    if (["failed", "cancelled", "canceled"].includes(providerStatus)) {
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        {
          $set: {
            status: "FAILED",
            failedAt: new Date(),
            providerTransactionId: String(transaction.id),
            verificationDetails: {
              status: providerStatus,
              amount: Number(transaction.amount),
              currency: String(transaction.currency || "").toUpperCase(),
              verifiedAt: new Date(),
            },
          },
        },
      );
      return { status: 200, message: "Payment was not completed.", payment: { ...safePayment(payment), status: "FAILED" } };
    }
    return { status: 400, message: "Flutterwave has not confirmed a successful payment." };
  }

  const result = await finishSuccessfulPayment({ payment, transaction, buyer });
  if (result.rejected) {
    return { status: 409, message: "This payment attempt can no longer be processed." };
  }
  if (result.alreadyProcessing) {
    return { status: 202, message: "Payment verification is already in progress." };
  }
  if (result.orderNeedsReview) {
    return {
      status: 409,
      message: "Payment succeeded, but the order requires administrative review.",
      payment: safePayment(result.payment),
      order: result.order,
    };
  }
  return {
    status: 200,
    message: result.alreadyProcessed
      ? "Payment has already been confirmed."
      : "Payment verified successfully.",
    payment: safePayment(result.payment),
    order: result.order,
  };
};

export const initializePayment = async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (Object.keys(req.body || {}).some((field) => field !== "orderId") || !orderId) {
      return res.status(400).json({ message: "A valid order ID is required." });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (String(order.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the buyer can pay for this order." });
    }
    if (order.paymentStatus === "PAID" || order.status === "COMPLETED") {
      return res.status(409).json({ message: "This order has already been paid for." });
    }
    if (order.status !== "PENDING_PAYMENT" ||
        !["PENDING", "FAILED"].includes(order.paymentStatus)) {
      return res.status(409).json({ message: "This order is not eligible for payment." });
    }
    const listing = await MarketplaceListing.findOne({
      _id: order.listing,
      status: "active",
      stock: { $gte: order.quantity },
    }).select("_id");
    if (!listing) {
      return res.status(409).json({ message: "This listing is no longer available for purchase." });
    }
    if (!Number.isFinite(order.totalAmount) || order.totalAmount <= 0) {
      return res.status(400).json({ message: "Invalid order amount." });
    }
    const amountMinorUnits = Math.round(order.totalAmount * 100);
    if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0) {
      return res.status(400).json({ message: "Invalid payment amount." });
    }
    const currency = String(order.currency || "NGN").toUpperCase();
    const redirectUrl = process.env.FLW_REDIRECT_URL;
    if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
      return res.status(503).json({ message: "Flutterwave checkout return URL is not configured." });
    }

    const existing = await Payment.findOne({
      order: order._id,
      provider: "FLUTTERWAVE",
      status: "PENDING",
      authorizationUrl: { $type: "string" },
    }).sort({ createdAt: -1 });
    if (existing?.authorizationUrl) {
      return res.json({
        message: "Payment already initialized.",
        payment: safePayment(existing),
        checkoutUrl: existing.authorizationUrl,
      });
    }

    const reference = `CC-FLW-${crypto.randomUUID()}`;
    const payment = await Payment.create({
      order: order._id,
      buyer: req.user._id,
      amount: order.totalAmount,
      currency,
      reference,
      provider: "FLUTTERWAVE",
      providerReference: reference,
    });

    try {
      const checkout = await initializeFlutterwaveCheckout({
        tx_ref: reference,
        amount: order.totalAmount,
        currency,
        redirect_url: redirectUrl,
        customer: {
          email: req.user.email,
          name: req.user.name || req.user.email,
          phonenumber: req.user.profile?.phone || order.deliveryPhone,
        },
        meta: {
          orderId: String(order._id),
          buyerId: String(req.user._id),
        },
        customizations: {
          title: "Campus Connect Marketplace",
          description: `Payment for order ${order._id}`,
        },
      });
      if (!checkout?.link || !/^https:\/\//i.test(checkout.link)) {
        const error = new Error("Flutterwave did not return a secure checkout link.");
        error.code = "FLUTTERWAVE_INVALID_CHECKOUT";
        throw error;
      }
      payment.authorizationUrl = checkout.link;
      await payment.save();
    } catch (error) {
      payment.status = "FAILED";
      payment.failedAt = new Date();
      await payment.save();
      console.error("Flutterwave checkout initialization failed", {
        code: error.code || "FLUTTERWAVE_API_ERROR",
        statusCode: error.statusCode,
      });
      return res.status(error.code === "FLUTTERWAVE_CONFIG_MISSING" ? 503 : 502).json({
        message: "We couldn't initialize Flutterwave checkout. Please retry payment.",
      });
    }

    return res.status(201).json({
      message: "Flutterwave checkout initialized successfully.",
      payment: safePayment(payment),
      checkoutUrl: payment.authorizationUrl,
    });
  } catch (error) {
    console.error("Payment initialization failed", {
      code: error.code || "PAYMENT_INITIALIZATION_ERROR",
    });
    return res.status(500).json({ message: "Failed to initialize payment." });
  }
};

export const confirmPayment = async (req, res) => {
  const { reference, transactionId } = req.body || {};
  if (
    Object.keys(req.body || {}).some((field) => !["reference", "transactionId"].includes(field)) ||
    typeof reference !== "string" ||
    reference.length > 100 ||
    !reference ||
    !/^\d+$/.test(String(transactionId || ""))
  ) {
    return res.status(400).json({ message: "A valid payment reference and Flutterwave transaction ID are required." });
  }
  try {
    const result = await verifyAndProcessFlutterwavePayment({
      reference,
      transactionId: String(transactionId),
      buyerId: req.user._id,
    });
    return res.status(result.status).json({
      message: result.message,
      ...(result.payment ? { payment: result.payment } : {}),
      ...(result.order ? {
        order: {
          id: result.order._id,
          status: result.order.status,
          paymentStatus: result.order.paymentStatus,
        },
      } : {}),
    });
  } catch (error) {
    console.error("Flutterwave payment verification failed", {
      code: error.code || "FLUTTERWAVE_VERIFICATION_ERROR",
      statusCode: error.statusCode,
    });
    return res.status(502).json({ message: "We couldn't verify the payment right now." });
  }
};

export const getPaymentByOrder = async (req, res) => {
  try {
    const payment = await Payment.findOne({ order: req.params.orderId })
      .sort({ createdAt: -1 });
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    if (String(payment.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: "You are not authorized to view this payment." });
    }
    return res.json({ payment: safePayment(payment) });
  } catch {
    return res.status(500).json({ message: "Failed to fetch payment." });
  }
};

export const getPaymentByReference = async (req, res) => {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference });
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    if (String(payment.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: "You are not authorized to view this payment." });
    }
    const order = await Order.findById(payment.order);
    return res.json({
      payment: safePayment(payment),
      order: order
        ? { id: order._id, status: order.status, paymentStatus: order.paymentStatus }
        : null,
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch payment." });
  }
};

export const handleFlutterwaveWebhook = async (req, res) => {
  const signature = req.get("verif-hash");
  if (!isValidFlutterwaveWebhook(signature)) {
    return res.status(401).json({ message: "Invalid webhook signature." });
  }

  const event = req.body;
  const transactionId = event?.data?.id;
  const reference = event?.data?.tx_ref;
  if (
    !["charge.completed", "charge.failed"].includes(event?.type) ||
    !transactionId ||
    typeof reference !== "string"
  ) {
    return res.status(200).json({ message: "Notification acknowledged." });
  }

  try {
    const payment = await Payment.findOne({
      provider: "FLUTTERWAVE",
      $or: [{ providerReference: reference }, { reference }],
    });
    if (!payment) return res.status(200).json({ message: "Unknown payment notification acknowledged." });
    if (payment.status === "SUCCESS" || payment.status === "FAILED") {
      return res.status(200).json({ message: "Duplicate notification acknowledged." });
    }
    const buyer = await User.findById(payment.buyer).select("email");
    if (!buyer) {
      return res.status(200).json({ message: "Payment notification acknowledged." });
    }

    const transaction = await verifyFlutterwaveTransaction(String(transactionId));
    if (!validateFlutterwaveTransaction({ transaction, payment, buyer })) {
      return res.status(200).json({ message: "Unmatched payment notification acknowledged." });
    }
    const providerStatus = String(transaction.status || "").toLowerCase();
    if (providerStatus === "successful") {
      await finishSuccessfulPayment({ payment, transaction, buyer });
    } else if (["failed", "cancelled", "canceled"].includes(providerStatus)) {
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        {
          $set: {
            status: "FAILED",
            failedAt: new Date(),
            providerTransactionId: String(transaction.id),
            verificationDetails: {
              status: providerStatus,
              amount: Number(transaction.amount),
              currency: String(transaction.currency || "").toUpperCase(),
              verifiedAt: new Date(),
            },
          },
        },
      );
    }
    return res.status(200).json({ message: "Notification processed." });
  } catch (error) {
    console.error("Flutterwave webhook processing failed", {
      code: error.code || "FLUTTERWAVE_WEBHOOK_ERROR",
      statusCode: error.statusCode,
    });
    return res.status(500).json({ message: "Webhook processing failed." });
  }
};
