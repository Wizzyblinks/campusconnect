import mongoose from "mongoose";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import VibeCheckInteraction from "../models/VibeCheckInteraction.js";
import {
  loadAuthorizedConversation,
  MessagingError,
  persistDirectMessage,
} from "../services/directMessageService.js";
import { safelyCreateNotification } from "../services/notificationService.js";

const getMessagingBlock = (firstUserId, secondUserId) =>
  VibeCheckInteraction.exists({
    action: "BLOCK",
    $or: [
      { actor: firstUserId, target: secondUserId },
      { actor: secondUserId, target: firstUserId },
    ],
  });

export const searchMessageRecipients = async (req, res) => {
  try {
    const search = req.query.search;
    if (typeof search !== "string" || search.trim().length < 2 || search.length > 80) {
      return res.status(400).json({
        message: "Enter at least two characters to search for students",
      });
    }

    const currentUser = await User.findById(req.user._id).select(
      "isVerifiedStudent institution",
    );
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filters = {
      _id: { $ne: req.user._id },
      isRestricted: { $ne: true },
      role: "student",
      institution: currentUser.institution,
      name: { $regex: escaped, $options: "i" },
    };
    if (!currentUser.isVerifiedStudent) {
      filters.isVerifiedStudent = { $ne: true };
    }
    const candidates = await User.find(filters)
      .select("name profile.avatar isVerifiedStudent isOnline")
      .sort({ name: 1 })
      .limit(20)
      .lean();
    if (candidates.length === 0) {
      return res.json({ users: [] });
    }
    const existing = await Conversation.find({
      participants: req.user._id,
      $or: candidates.map((candidate) => ({
        participants: candidate._id,
      })),
    }).select("participants status");
    const existingByUser = new Map();
    existing.forEach((conversation) => {
      const other = conversation.participants.find(
        (participant) => participant.toString() !== req.user._id.toString(),
      );
      if (other) existingByUser.set(other.toString(), conversation);
    });

    const users = [];
    for (const candidate of candidates) {
      if (await getMessagingBlock(req.user._id, candidate._id)) {
        continue;
      }
      const conversation = existingByUser.get(candidate._id.toString());
      users.push({
        ...candidate,
        conversationId: conversation?._id || null,
        conversationStatus: conversation?.status || null,
      });
    }
    return res.json({ users });
  } catch (error) {
    console.error("Search message recipients error:", error.message);
    return res.status(500).json({ message: "Failed to search students" });
  }
};

export const startConversation = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({
        message: "A valid receiver ID is required",
      });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        message: "You cannot message yourself",
      });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (
      sender.role !== "student" ||
      receiver.role !== "student" ||
      !sender.institution ||
      !receiver.institution ||
      sender.institution.toString() !== receiver.institution.toString()
    ) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    if (sender.isRestricted || receiver.isRestricted) {
      return res.status(403).json({
        message: "Messaging is unavailable for this account",
      });
    }

    const senderVerified = sender.isVerifiedStudent === true;
    const receiverVerified = receiver.isVerifiedStudent === true;

    // Unverified users cannot initiate conversations with verified users
    if (!senderVerified && receiverVerified) {
      return res.status(403).json({
        message:
          "You must be a paid verified user to start a conversation with a verified user",
      });
    }

    // Check if conversation already exists
    if (await getMessagingBlock(senderId, receiverId)) {
      return res.status(403).json({
        message: "You cannot start a conversation with this user",
      });
    }

    const participantPair = [senderId.toString(), receiverId.toString()]
      .sort()
      .join(":");
    const existingConversation = await Conversation.findOne({
      $or: [
        { participantPair },
        { participants: { $all: [senderId, receiverId] } },
      ],
    });

    if (existingConversation) {
      return res.status(200).json({
        message: "Conversation already exists",
        conversation: existingConversation,
      });
    }

    const conversation = await Conversation.create({
      participants: [senderId, receiverId],
      initiatedBy: senderId,
      participantPair,
      status: "PENDING",
    });

    req.app
      .get("io")
      ?.to(`user:${receiverId}`)
      .emit("dm:request", { conversationId: conversation._id });

    return res.status(201).json({
      message: "Conversation request sent",
      conversation,
    });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const participantPair = [
          req.user._id.toString(),
          req.body.receiverId.toString(),
        ]
          .sort()
          .join(":");
        const existingConversation = await Conversation.findOne({
          participantPair,
        });
        if (existingConversation) {
          return res.status(200).json({
            message: "Conversation already exists",
            conversation: existingConversation,
          });
        }
      } catch (lookupError) {
        console.error("Existing conversation lookup failed:", lookupError.message);
      }
    }
    console.error("Start conversation error:", error);

    return res.status(500).json({
      message: "Failed to start conversation",
    });
  }
};

export const acceptConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.user._id.toString(),
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "You are not part of this conversation",
      });
    }

    if (conversation.status !== "PENDING") {
      return res.status(400).json({
        message: "This conversation request is no longer pending",
      });
    }

    if (conversation.initiatedBy.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the recipient can accept this request",
      });
    }

    if (await getMessagingBlock(req.user._id, conversation.initiatedBy)) {
      return res.status(403).json({
        message: "This conversation cannot be accepted because a participant is blocked",
      });
    }

    conversation.status = "ACCEPTED";

    await conversation.save();

    req.app
      .get("io")
      ?.to(`user:${conversation.initiatedBy}`)
      .emit("dm:request-updated", { conversationId, status: "ACCEPTED" });

    res.json({
      message: "Conversation request accepted",
      conversation,
    });
  } catch (error) {
    console.error("Accept conversation error:", error);

    res.status(500).json({
      message: "Failed to accept conversation",
    });
  }
};

export const declineConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.user._id.toString(),
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "You are not part of this conversation",
      });
    }

    if (conversation.status !== "PENDING") {
      return res.status(400).json({
        message: "This conversation request is no longer pending",
      });
    }

    if (conversation.initiatedBy.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the recipient can decline this request",
      });
    }

    conversation.status = "DECLINED";

    await conversation.save();

    req.app
      .get("io")
      ?.to(`user:${conversation.initiatedBy}`)
      .emit("dm:request-updated", { conversationId, status: "DECLINED" });

    res.json({
      message: "Conversation request declined",
      conversation,
    });
  } catch (error) {
    console.error("Decline conversation error:", error);

    res.status(500).json({
      message: "Failed to decline conversation",
    });
  }
};

export const reportConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    const { reason = "" } = req.body;
    if (typeof reason !== "string" || reason.trim().length > 500) {
      return res.status(400).json({ message: "Report details must be 500 characters or fewer" });
    }
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.user._id.toString(),
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "You are not part of this conversation",
      });
    }

    if (conversation.status === "REPORTED") {
      return res.status(409).json({ message: "This conversation has already been reported" });
    }
    conversation.status = "REPORTED";
    conversation.reportReason = reason.trim();
    conversation.reportedBy = req.user._id;
    conversation.moderationStatus = "OPEN";

    await conversation.save();

    res.json({
      message: "Conversation reported",
      conversation,
    });
  } catch (error) {
    console.error("Report conversation error:", error);

    res.status(500).json({
      message: "Failed to report conversation",
    });
  }
};

export const sendDirectMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { conversation, receiverId } = await loadAuthorizedConversation(
      conversationId,
      req.user._id,
      { requireAccepted: true },
    );
    const populatedMessage = await persistDirectMessage({
      conversation,
      senderId: req.user._id,
      receiverId,
      content: req.body?.message,
      clientMessageId: req.body?.clientMessageId,
    });

    const io = req.app.get("io");
    await safelyCreateNotification({
      io,
      recipient: receiverId,
      actor: req.user._id,
      type: "direct_message",
      title: `${req.user.name} sent you a message`,
      message: "Open the conversation to read it.",
      targetType: "conversation",
      targetId: conversation._id,
      sourceId: populatedMessage._id,
    });
    if (io) {
      const payload = { conversationId, message: populatedMessage };
      io.to(`conversation:${conversationId}`).emit("dm:new", payload);
      io.to(`user:${receiverId}`).emit("dm:new", payload);
      io.to(`user:${req.user._id}`).emit("dm:preview", payload);
    }

    return res.status(201).json({
      message: "Message sent",
      data: populatedMessage,
    });
  } catch (error) {
    if (error instanceof MessagingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Send direct message error:", error.message);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

export const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name profile.avatar isVerifiedStudent isOnline")
      .populate({
        path: "lastMessage",
        select: "message sender receiver createdAt isRead",
        populate: { path: "sender", select: "name profile.avatar" },
      })
      .sort({ lastMessageAt: -1, createdAt: -1 });

    const unreadCounts = await DirectMessage.aggregate([
      {
        $match: {
          receiver: req.user._id,
          isRead: false,
          conversation: { $in: conversations.map((conversation) => conversation._id) },
        },
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]);
    const unreadByConversation = new Map(
      unreadCounts.map(({ _id, count }) => [_id.toString(), count]),
    );

    return res.json({
      conversations: conversations.map((conversation) => ({
        ...conversation.toObject(),
        unreadCount: unreadByConversation.get(conversation._id.toString()) || 0,
      })),
    });
  } catch (error) {
    console.error("Get conversations error:", error.message);
    return res.status(500).json({ message: "Failed to get conversations" });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { conversation } = await loadAuthorizedConversation(
      conversationId,
      req.user._id,
    );
    const unreadMessages = await DirectMessage.updateMany(
      { conversation: conversationId, receiver: req.user._id, isRead: false },
      { $set: { isRead: true } },
    );
    const messages = await DirectMessage.find({ conversation: conversationId })
      .select("conversation sender receiver message messageType isRead createdAt clientMessageId")
      .populate("sender", "name profile.avatar")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const result = messages.reverse();
    const io = req.app.get("io");
    if (io && unreadMessages.modifiedCount) {
      const payload = { conversationId, readerId: req.user._id };
      io.to(`conversation:${conversationId}`).emit("dm:read", payload);
      io.to(`user:${req.user._id}`).emit("dm:read", payload);
    }

    return res.json({ conversation, messages: result });
  } catch (error) {
    if (error instanceof MessagingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Get conversation messages error:", error.message);
    return res.status(500).json({ message: "Failed to get conversation messages" });
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { conversation } = await loadAuthorizedConversation(
      conversationId,
      req.user._id,
    );
    await DirectMessage.updateMany(
      { conversation: conversation._id, receiver: req.user._id, isRead: false },
      { $set: { isRead: true } },
    );
    const readerId = req.user._id;
    const io = req.app.get("io");
    if (io) {
      const event = { conversationId, readerId };
      io.to(`conversation:${conversationId}`).emit("dm:read", event);
      io.to(`user:${readerId}`).emit("dm:read", event);
    }
    return res.json({ message: "Conversation marked as read" });
  } catch (error) {
    if (error instanceof MessagingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Mark conversation read error:", error.message);
    return res.status(500).json({ message: "Failed to mark conversation as read" });
  }
};
