import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
const getVerificationStatus = (user) => {
  return user.verificationStatus === "VERIFIED";
};

export const startConversation = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        message: "Receiver ID is required",
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

    const senderVerified = getVerificationStatus(sender);
    const receiverVerified = getVerificationStatus(receiver);

    // Unverified users cannot initiate conversations with verified users
    if (!senderVerified && receiverVerified) {
      return res.status(403).json({
        message:
          "You must be a paid verified user to start a conversation with a verified user",
      });
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      participants: {
        $all: [senderId, receiverId],
      },
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
      status: "PENDING",
    });

    return res.status(201).json({
      message: "Conversation request sent",
      conversation,
    });
  } catch (error) {
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

    conversation.status = "ACCEPTED";

    await conversation.save();

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

    conversation.status = "REPORTED";

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
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message cannot be empty",
      });
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

    if (conversation.status !== "ACCEPTED") {
      return res.status(403).json({
        message:
          "You cannot send messages until the conversation request is accepted",
      });
    }

    const receiverId = conversation.participants.find(
      (participant) => participant.toString() !== req.user._id.toString(),
    );

    const newMessage = await DirectMessage.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: receiverId,
      message: message.trim(),
      messageType: "TEXT",
    });

    conversation.lastMessage = newMessage._id;
    conversation.lastMessageAt = newMessage.createdAt;

    await conversation.save();

    const populatedMessage = await DirectMessage.findById(
      newMessage._id,
    ).populate("sender", "name email profile.avatar");

    return res.status(201).json({
      message: "Message sent",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send direct message error:", error);

    return res.status(500).json({
      message: "Failed to send message",
    });
  }
};

export const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name email profile.avatar verificationStatus")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1, createdAt: -1 });

    res.json({
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    res.status(500).json({
      message: "Failed to get conversations",
    });
  }
};

export const getConversationMessages = async (req, res) => {
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

    const messages = await DirectMessage.find({
      conversation: conversationId,
    })
      .populate("sender", "name email profile.avatar")
      .sort({ createdAt: 1 });

    res.json({
      conversation,
      messages,
    });
  } catch (error) {
    console.error("Get conversation messages error:", error);

    res.status(500).json({
      message: "Failed to get conversation messages",
    });
  }
};
