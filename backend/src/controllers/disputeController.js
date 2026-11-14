import Dispute from "../models/Dispute.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { requestProviderRefund } from "../services/refundService.js";

export const createDispute = async (req, res) => {
  try {
    const { reason, description } = req.body || {};
    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({ message: "Reason and description are required." });
    }
    if (reason.trim().length > 500 || description.trim().length > 2000) {
      return res.status(400).json({ message: "Reason or description exceeds the allowed length." });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (String(order.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the buyer can open a dispute." });
    }
    if (order.paymentStatus !== "PAID") {
      return res.status(400).json({ message: "Only paid orders can be disputed." });
    }
    if (["CANCELLED", "REFUNDED"].includes(order.status)) {
      return res.status(400).json({ message: "This order cannot be disputed." });
    }
    if (await Dispute.exists({ order: order._id })) {
      return res.status(409).json({ message: "A dispute already exists for this order." });
    }

    const dispute = await Dispute.create({
      order: order._id,
      buyer: order.buyer,
      seller: order.seller,
      reason: reason.trim(),
      description: description.trim(),
    });
    order.status = "DISPUTED";
    order.sellerPayoutStatus = "ON_HOLD";
    await order.save();
    return res.status(201).json({
      message: "Dispute opened successfully.",
      dispute,
      order,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A dispute already exists for this order." });
    }
    console.error("Create dispute failed:", error.message);
    return res.status(500).json({ message: "Failed to create dispute." });
  }
};

export const getMyDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    })
      .populate("order")
      .populate("buyer", "name username email")
      .populate("seller", "name username email")
      .sort({ createdAt: -1 });
    return res.json({ count: disputes.length, disputes });
  } catch (error) {
    console.error("Fetch disputes failed:", error.message);
    return res.status(500).json({ message: "Failed to fetch disputes." });
  }
};

export const getDisputeById = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate("order")
      .populate("buyer", "name username email")
      .populate("seller", "name username email")
      .populate("resolvedBy", "name email");
    if (!dispute) return res.status(404).json({ message: "Dispute not found." });

    const isBuyer = String(dispute.buyer._id) === String(req.user._id);
    const isSeller = String(dispute.seller._id) === String(req.user._id);
    if (!isBuyer && !isSeller && req.user.role !== "admin") {
      return res.status(403).json({ message: "You are not authorized to view this dispute." });
    }
    return res.json({ dispute });
  } catch (error) {
    console.error("Fetch dispute failed:", error.message);
    return res.status(500).json({ message: "Failed to fetch dispute." });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { resolution, resolutionNote = "", refundAmount } = req.body || {};
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only administrators can resolve disputes." });
    }
    if (!["BUYER", "SELLER"].includes(resolution)) {
      return res.status(400).json({ message: "Resolution must be BUYER or SELLER." });
    }
    if (typeof resolutionNote !== "string" || resolutionNote.length > 1000) {
      return res.status(400).json({ message: "Resolution note must be 1,000 characters or fewer." });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: "Dispute not found." });
    if (["RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"].includes(dispute.status)) {
      return res.status(409).json({ message: "This dispute has already been resolved." });
    }
    const order = await Order.findById(dispute.order);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.status !== "DISPUTED") {
      return res.status(409).json({ message: "The order is not currently under dispute." });
    }

    if (resolution === "BUYER") {
      if (order.paymentStatus !== "PAID") {
        return res.status(409).json({ message: "The order does not have a refundable paid status." });
      }
      const payment = await Payment.findOne({
        order: order._id,
        status: "SUCCESS",
      }).sort({ createdAt: -1 });
      if (!payment) {
        return res.status(409).json({ message: "A successful payment was not found for this order." });
      }
      const amount =
        refundAmount === undefined || refundAmount === null || refundAmount === ""
          ? order.totalAmount
          : Number(refundAmount);
      if (!Number.isFinite(amount) || amount <= 0 ||
          amount > order.totalAmount || amount > payment.amount) {
        return res.status(400).json({ message: "Refund amount must be positive and within the paid amount." });
      }
      if (["PENDING", "PROCESSED"].includes(payment.refundStatus)) {
        return res.status(409).json({
          message: payment.refundStatus === "PENDING"
            ? "A refund is already pending for this payment."
            : "This payment has already been refunded.",
        });
      }

      payment.status = "REFUND_PENDING";
      payment.refundStatus = "PENDING";
      payment.refundAmount = amount;
      order.paymentStatus = "REFUND_PENDING";
      order.sellerPayoutStatus = "ON_HOLD";
      await payment.save();
      await order.save();

      let refund;
      try {
        refund = await requestProviderRefund(payment, amount);
      } catch (error) {
        console.error("Payment provider refund request failed:", {
          provider: payment.provider || "PAYSTACK",
          code: error.code || "REFUND_REQUEST_FAILED",
          statusCode: error.statusCode,
        });
        return res.status(502).json({
          message: "The refund outcome could not be confirmed. The order remains on hold; verify the provider status before retrying.",
        });
      }

      payment.refundId = Number.isSafeInteger(Number(refund.id))
        ? Number(refund.id)
        : null;
      payment.refundProviderId = refund.id ? String(refund.id) : "";
      const providerStatus = String(refund.status || "").toLowerCase();
      if (["processed", "success", "successful", "completed"].includes(providerStatus)) {
        payment.status = "REFUNDED";
        payment.refundStatus = "PROCESSED";
        order.paymentStatus = "REFUNDED";
        order.status = "REFUNDED";
        order.sellerPayoutStatus = "REFUNDED";
        dispute.status = "RESOLVED_BUYER";
        dispute.refundAmount = amount;
        dispute.resolutionNote = resolutionNote.trim();
        dispute.resolvedBy = req.user._id;
        dispute.resolvedAt = new Date();
        await Promise.all([payment.save(), order.save(), dispute.save()]);
        return res.json({ message: "Refund processed and dispute resolved.", dispute, order });
      }

      payment.status = "REFUND_PENDING";
      payment.refundStatus = "PENDING";
      order.paymentStatus = "REFUND_PENDING";
      order.status = "DISPUTED";
      order.sellerPayoutStatus = "ON_HOLD";
      await Promise.all([payment.save(), order.save()]);
      return res.status(202).json({
        message: "Refund request is pending provider processing. The order remains on hold.",
        refundStatus: payment.refundStatus,
        disputeId: dispute._id,
      });
    }

    if (order.paymentStatus !== "PAID") {
      return res.status(409).json({ message: "The order payment is not in a valid state." });
    }
    dispute.status = "RESOLVED_SELLER";
    dispute.refundAmount = 0;
    dispute.resolutionNote = resolutionNote.trim();
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();
    if (order.deliveryStatus === "VERIFIED") {
      order.status = "COMPLETED";
      order.sellerPayoutStatus = "ELIGIBLE";
    } else {
      order.status = "PAID";
      order.sellerPayoutStatus = "PENDING";
    }
    await Promise.all([dispute.save(), order.save()]);
    return res.json({
      message: "Dispute resolved in favour of the seller.",
      dispute,
      order,
    });
  } catch (error) {
    console.error("Resolve dispute failed:", error.message);
    return res.status(500).json({ message: "Failed to resolve dispute." });
  }
};
