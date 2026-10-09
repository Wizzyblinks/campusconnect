import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import MarketplaceListing from "../models/MarketplaceListing.js";

export const initializePayment = async (req, res) => {
  try {
    const { orderId } = req.body;

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

    if (order.paymentStatus === "PAID") {
      return res.status(400).json({
        message: "This order has already been paid for",
      });
    }

    const existingPayment = await Payment.findOne({
      order: order._id,
    });

    if (existingPayment) {
      return res.status(200).json({
        message: "Payment already initialized",
        payment: existingPayment,
      });
    }

    const reference = `CC-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const payment = await Payment.create({
      order: order._id,
      buyer: req.user._id,
      amount: order.totalAmount,
      reference,
      provider: "TEST",
    });

    res.status(201).json({
      message: "Payment initialized successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
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

    const payment = await Payment.findOne({ reference });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    if (payment.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to confirm this payment",
      });
    }

    if (payment.status === "SUCCESS") {
      return res.status(400).json({
        message: "Payment has already been confirmed",
      });
    }

    payment.status = "SUCCESS";
    payment.paidAt = new Date();

    await payment.save();

    const order = await Order.findById(payment.order);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const listing = await MarketplaceListing.findOneAndUpdate(
      {
        _id: order.listing,
        status: "active",
        stock: { $gte: order.quantity },
      },
      {
        $inc: { stock: -order.quantity },
      },
      {
        new: true,
      },
    );

    if (!listing) {
      return res.status(400).json({
        message: "Not enough stock available",
      });
    }

    if (listing.stock === 0) {
      listing.status = "sold";
      await listing.save();
    }

    order.paymentStatus = "PAID";
    order.status = "PAID";
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payment",
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

    res.json({
      payment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payment",
      error: error.message,
    });
  }
};
