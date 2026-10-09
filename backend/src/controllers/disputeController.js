import Dispute from "../models/Dispute.js";
import Order from "../models/Order.js";

export const createDispute = async (req, res) => {
  try {
    const { reason, description } = req.body;

    if (!reason || !description) {
      return res.status(400).json({
        message: "Reason and description are required",
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

    const existingDispute = await Dispute.findOne({
      order: order._id,
    });

    if (existingDispute) {
      return res.status(400).json({
        message: "A dispute already exists for this order",
      });
    }

    const dispute = await Dispute.create({
      order: order._id,
      buyer: order.buyer,
      seller: order.seller,
      reason,
      description,
    });

    order.status = "DISPUTED";

    await order.save();

    res.status(201).json({
      message: "Dispute opened successfully",
      dispute,
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create dispute",
      error: error.message,
    });
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

    res.json({
      count: disputes.length,
      disputes,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch disputes",
      error: error.message,
    });
  }
};

export const getDisputeById = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate("order")
      .populate("buyer", "name email")
      .populate("seller", "name email")
      .populate("resolvedBy", "name email");

    if (!dispute) {
      return res.status(404).json({
        message: "Dispute not found",
      });
    }

    const isBuyer = dispute.buyer._id.toString() === req.user._id.toString();

    const isSeller = dispute.seller._id.toString() === req.user._id.toString();

    const isAdmin = req.user.role === "admin";

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        message: "You are not authorized to view this dispute",
      });
    }

    res.json({
      dispute,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch dispute",
      error: error.message,
    });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { resolution, resolutionNote, refundAmount } = req.body;

    if (!["BUYER", "SELLER"].includes(resolution)) {
      return res.status(400).json({
        message: "Resolution must be BUYER or SELLER",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can resolve disputes",
      });
    }

    const dispute = await Dispute.findById(req.params.id);

    if (!dispute) {
      return res.status(404).json({
        message: "Dispute not found",
      });
    }

    if (dispute.status === "CLOSED") {
      return res.status(400).json({
        message: "This dispute is already closed",
      });
    }

    const order = await Order.findById(dispute.order);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (resolution === "BUYER") {
      const amount = refundAmount || order.totalAmount;

      if (amount > order.totalAmount) {
        return res.status(400).json({
          message: "Refund amount cannot exceed order total",
        });
      }

      dispute.status = "RESOLVED_BUYER";
      dispute.refundAmount = amount;

      order.paymentStatus = "REFUNDED";
      order.status = "REFUNDED";
      order.sellerPayoutStatus = "REFUNDED";
    }

    if (resolution === "SELLER") {
      dispute.status = "RESOLVED_SELLER";
      dispute.refundAmount = 0;

      order.status = "COMPLETED";
    }

    dispute.resolutionNote = resolutionNote || "";
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();

    await dispute.save();
    await order.save();

    res.json({
      message: "Dispute resolved successfully",
      dispute,
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to resolve dispute",
      error: error.message,
    });
  }
};

export const sendGroupImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (
      group.institution.toString() !== user.institution.toString() ||
      group.campus.toString() !== user.campus.toString()
    ) {
      return res.status(403).json({
        message: "You cannot access this group",
      });
    }

    const isMember = group.members.some(
      (member) => member.user.toString() === user._id.toString(),
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this group",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an image",
      });
    }

    const imageUrl = `/uploads/groups/${req.file.filename}`;

    const newMessage = await GroupMessage.create({
      group: group._id,
      sender: user._id,
      message: imageUrl,
      messageType: "IMAGE",
    });

    const populatedMessage = await GroupMessage.findById(
      newMessage._id,
    ).populate("sender", "name email profile.avatar");

    const io = req.app.get("io");

    io.to(`group:${group._id}`).emit("group:message", {
      message: populatedMessage,
    });

    res.status(201).json({
      message: "Image sent successfully",
      groupMessage: populatedMessage,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to send image",
      error: error.message,
    });
  }
};
