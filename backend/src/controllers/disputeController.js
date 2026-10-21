import Dispute from "../models/Dispute.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";

const PAYSTACK_API = "https://api.paystack.co";

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

const requestPaystackRefund = async (reference, amount) => {
  const response = await fetch(`${PAYSTACK_API}/refund`, {
    method: "POST",
    headers: getPaystackHeaders(),
    body: JSON.stringify({
      transaction: reference,
      amount: Math.round(amount * 100),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.status) {
    throw new Error(data.message || "Paystack refund request failed");
  }

  return data.data;
};

export const createDispute = async (req, res) => {
  try {
    const { reason, description } = req.body;

    ```
if (
  typeof reason !== "string" ||
  !reason.trim() ||
  typeof description !== "string" ||
  !description.trim()
) {
  return res.status(400).json({
    message: "Reason and description are required",
  });
}

if (reason.trim().length > 500 || description.trim().length > 2000) {
  return res.status(400).json({
    message: "Reason or description exceeds the allowed length",
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
    message: "Only the buyer can open a dispute",
  });
}

if (order.paymentStatus !== "PAID") {
  return res.status(400).json({
    message: "Only paid orders can be disputed",
  });
}

if (["CANCELLED", "REFUNDED"].includes(order.status)) {
  return res.status(400).json({
    message: "This order cannot be disputed",
  });
}

const existingDispute = await Dispute.findOne({
  order: order._id,
});

if (existingDispute) {
  return res.status(409).json({
    message: "A dispute already exists for this order",
  });
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
  message: "Dispute opened successfully",
  dispute,
  order,
});
```;
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A dispute already exists for this order",
      });
    }

    ```
console.error("Create dispute error:", error.message);

return res.status(500).json({
  message: "Failed to create dispute",
});
```;
  }
};

export const getMyDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    })
      .populate("order")
      .populate("buyer", "name email")
      .populate("seller", "name email")
      .sort({ createdAt: -1 });

    ```
return res.json({
  count: disputes.length,
  disputes,
});
```;
  } catch (error) {
    console.error("Fetch disputes error:", error.message);

    ```
return res.status(500).json({
  message: "Failed to fetch disputes",
});
```;
  }
};

export const getDisputeById = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate("order")
      .populate("buyer", "name email")
      .populate("seller", "name email")
      .populate("resolvedBy", "name email");

    ```
if (!dispute) {
  return res.status(404).json({
    message: "Dispute not found",
  });
}

const isBuyer =
  dispute.buyer._id.toString() === req.user._id.toString();

const isSeller =
  dispute.seller._id.toString() === req.user._id.toString();

const isAdmin = req.user.role === "admin";

if (!isBuyer && !isSeller && !isAdmin) {
  return res.status(403).json({
    message: "You are not authorized to view this dispute",
  });
}

return res.json({ dispute });
```;
  } catch (error) {
    console.error("Fetch dispute error:", error.message);

    ```
return res.status(500).json({
  message: "Failed to fetch dispute",
});
```;
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { resolution, resolutionNote, refundAmount } = req.body;

    ```
if (req.user.role !== "admin") {
  return res.status(403).json({
    message: "Only admins can resolve disputes",
  });
}

if (!["BUYER", "SELLER"].includes(resolution)) {
  return res.status(400).json({
    message: "Resolution must be BUYER or SELLER",
  });
}

if (
  resolutionNote !== undefined &&
  (typeof resolutionNote !== "string" ||
    resolutionNote.length > 1000)
) {
  return res.status(400).json({
    message: "Resolution note must be 1000 characters or fewer",
  });
}

const dispute = await Dispute.findById(req.params.id);

if (!dispute) {
  return res.status(404).json({
    message: "Dispute not found",
  });
}

if (
  ["RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"].includes(
    dispute.status,
  )
) {
  return res.status(409).json({
    message: "This dispute has already been resolved",
  });
}

const order = await Order.findById(dispute.order);

if (!order) {
  return res.status(404).json({
    message: "Order not found",
  });
}

if (order.status !== "DISPUTED") {
  return res.status(409).json({
    message: "The order is not currently under dispute",
  });
}

if (resolution === "BUYER") {
  if (order.paymentStatus !== "PAID") {
    return res.status(409).json({
      message: "The order does not have a refundable paid status",
    });
  }

  const payment = await Payment.findOne({
    order: order._id,
    provider: "PAYSTACK",
    status: "SUCCESS",
  });

  if (!payment) {
    return res.status(409).json({
      message: "A successful Paystack payment was not found",
    });
  }

  const amount =
    refundAmount === undefined ||
    refundAmount === null ||
    refundAmount === ""
      ? order.totalAmount
      : Number(refundAmount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > order.totalAmount ||
    amount > payment.amount
  ) {
    return res.status(400).json({
      message: "Refund amount must be positive and within the paid amount",
    });
  }

  if (payment.refundStatus === "PENDING") {
    return res.status(409).json({
      message: "A refund is already pending for this payment",
    });
  }

  if (payment.refundStatus === "PROCESSED") {
    return res.status(409).json({
      message: "This payment has already been refunded",
    });
  }

  // Keep the order and payout on hold while Paystack processes the refund.
  payment.status = "REFUND_PENDING";
  payment.refundStatus = "PENDING";
  payment.refundAmount = amount;

  order.paymentStatus = "REFUND_PENDING";
  order.sellerPayoutStatus = "ON_HOLD";

  await payment.save();
  await order.save();

  let refund;

  try {
    refund = await requestPaystackRefund(
      payment.reference,
      amount,
    );
  } catch (error) {
    // Do not falsely mark the order as refunded.
    // Keep it on hold because the provider's outcome may need review.
    console.error("Paystack refund request error:", error.message);

    return res.status(502).json({
      message:
        "The refund could not be confirmed. The order remains on hold; verify its status in Paystack before retrying.",
    });
  }

  payment.refundId =
    typeof refund.id === "number" ? refund.id : null;

  const providerStatus = String(refund.status || "").toLowerCase();

  if (
    ["processed", "success", "successful"].includes(providerStatus)
  ) {
    payment.status = "REFUNDED";
    payment.refundStatus = "PROCESSED";

    order.paymentStatus = "REFUNDED";
    order.status = "REFUNDED";
    order.sellerPayoutStatus = "REFUNDED";

    dispute.status = "RESOLVED_BUYER";
    dispute.refundAmount = amount;
    dispute.resolutionNote = resolutionNote || "";
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();

    await payment.save();
    await order.save();
    await dispute.save();

    return res.json({
      message: "Refund processed and dispute resolved",
      dispute,
      order,
    });
  }

  // Paystack may accept a refund request without processing it immediately.
  payment.status = "REFUND_PENDING";
  payment.refundStatus = "PENDING";

  order.paymentStatus = "REFUND_PENDING";
  order.status = "DISPUTED";
  order.sellerPayoutStatus = "ON_HOLD";

  await payment.save();
  await order.save();

  return res.status(202).json({
    message:
      "Refund request accepted and pending processing. The order remains on hold until the refund is confirmed.",
    refundStatus: payment.refundStatus,
    disputeId: dispute._id,
  });
}

// A seller-favouring resolution must not bypass delivery verification.
if (order.paymentStatus !== "PAID") {
  return res.status(409).json({
    message: "The order payment is not in a valid state",
  });
}

dispute.status = "RESOLVED_SELLER";
dispute.refundAmount = 0;
dispute.resolutionNote = resolutionNote || "";
dispute.resolvedBy = req.user._id;
dispute.resolvedAt = new Date();

if (order.deliveryStatus === "VERIFIED") {
  order.status = "COMPLETED";
  order.sellerPayoutStatus = "ELIGIBLE";
} else {
  order.status = "PAID";
  order.sellerPayoutStatus = "PENDING";
}

await dispute.save();
await order.save();

return res.json({
  message: "Dispute resolved in favour of the seller",
  dispute,
  order,
});
```;
  } catch (error) {
    console.error("Resolve dispute error:", error.message);

    ```
return res.status(500).json({
  message: "Failed to resolve dispute",
});
```;
  }
};
