import Order from "../models/Order.js";

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the seller can update delivery status",
      });
    }

    if (order.paymentStatus !== "PAID") {
      return res.status(400).json({
        message: "Order must be paid before delivery can begin",
      });
    }

    order.deliveryStatus = status;

    if (status === "PROCESSING") {
      order.status = "PROCESSING";
    }

    if (status === "READY") {
      order.status = "READY_FOR_DELIVERY";
    }

    if (status === "OUT_FOR_DELIVERY") {
      order.status = "OUT_FOR_DELIVERY";
    }

    if (status === "DELIVERED") {
      order.status = "DELIVERED";

      const otp = generateOtp();

      order.deliveryOtp = otp;

      order.deliveryOtpExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    }

    await order.save();

    res.json({
      message: "Delivery status updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update delivery status",
      error: error.message,
    });
  }
};

export const verifyDelivery = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        message: "Delivery OTP is required",
      });
    }

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the buyer can verify delivery",
      });
    }

    if (order.deliveryStatus !== "DELIVERED") {
      return res.status(400).json({
        message: "Order has not been marked as delivered",
      });
    }

    if (!order.deliveryOtp) {
      return res.status(400).json({
        message: "No delivery OTP exists for this order",
      });
    }

    if (order.deliveryOtpExpiresAt && order.deliveryOtpExpiresAt < new Date()) {
      return res.status(400).json({
        message: "Delivery OTP has expired",
      });
    }

    if (otp !== order.deliveryOtp) {
      return res.status(400).json({
        message: "Invalid delivery OTP",
      });
    }

    order.deliveryStatus = "VERIFIED";
    order.status = "COMPLETED";
    order.sellerPayoutStatus = "RELEASED";
    order.completedAt = new Date();

    order.deliveryOtp = null;
    order.deliveryOtpExpiresAt = null;

    await order.save();

    res.json({
      message: "Delivery verified successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to verify delivery",
      error: error.message,
    });
  }
};
