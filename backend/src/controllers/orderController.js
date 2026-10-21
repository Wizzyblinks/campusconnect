import Order from "../models/Order.js";
import MarketplaceListing from "../models/MarketplaceListing.js";

const PLATFORM_COMMISSION_RATE = 0.07;
const MIDDLEMAN_DELIVERY_FEE = 500;

export const createOrder = async (req, res) => {
  try {
    const { listingId, quantity, deliveryAddress, deliveryPhone, buyerNote, deliveryMethod } =
      req.body;

    const requestedQuantity = Number(quantity);

    if (
      !listingId ||
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity < 1 ||
      !["MIDDLEMAN", "SELLER_TO_BUYER"].includes(deliveryMethod) ||
      !deliveryAddress?.trim() ||
      !deliveryPhone?.trim()
    ) {
      return res.status(400).json({
        message:
          "Listing, quantity, delivery address and delivery phone are required",
      });
    }

    const listing = await MarketplaceListing.findOne({
      _id: listingId,
      institution: req.user.institution,
      campus: req.user.campus,
    });

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found",
      });
    }

    if (listing.status !== "active") {
      return res.status(400).json({
        message: "This listing is no longer available",
      });
    }

    if (listing.stock < requestedQuantity) {
      return res.status(400).json({
        message: "Not enough stock available",
      });
    }

    if (listing.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot order your own listing",
      });
    }

    const itemSubtotal = listing.price * requestedQuantity;
    const deliveryFee =
      deliveryMethod === "MIDDLEMAN" ? MIDDLEMAN_DELIVERY_FEE : 0;
    const platformCommission = Math.round(
      itemSubtotal * PLATFORM_COMMISSION_RATE * 100,
    ) / 100;
    const sellerPayoutAmount = itemSubtotal - platformCommission;
    const totalAmount = itemSubtotal + deliveryFee;

    const order = await Order.create({
      buyer: req.user._id,
      seller: listing.seller,
      listing: listing._id,
      quantity: requestedQuantity,
      unitPrice: listing.price,
      totalAmount,
      deliveryMethod,
      deliveryFee,
      platformCommissionRate: PLATFORM_COMMISSION_RATE,
      platformCommission,
      sellerPayoutAmount,
      deliveryAddress,
      deliveryPhone,
      buyerNote: buyerNote || "",
    });

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create order",
      error: error.message,
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    })
      .populate("buyer", "name email profile.avatar")
      .populate("seller", "name email profile.avatar")
      .populate("listing", "title price images category")
      .sort({ createdAt: -1 });

    res.json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name email profile.avatar")
      .populate("seller", "name email profile.avatar")
      .populate("listing", "title price images category");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const isBuyer = order.buyer._id.toString() === req.user._id.toString();

    const isSeller = order.seller._id.toString() === req.user._id.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        message: "You are not authorized to view this order",
      });
    }

    res.json({
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the buyer can cancel this order",
      });
    }

    if (!["PENDING_PAYMENT", "PAID", "PROCESSING"].includes(order.status)) {
      return res.status(400).json({
        message: "This order can no longer be cancelled",
      });
    }

    order.status = "CANCELLED";

    await order.save();

    res.json({
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};
