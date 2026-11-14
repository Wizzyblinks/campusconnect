import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import User from "../models/User.js";
import VibeCheckInteraction from "../models/VibeCheckInteraction.js";
import { isConversationParticipant } from "./conversationAccess.js";

export class MessagingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const canSendInConversation = (
  conversation,
  userId,
  hasRequestMessage = false,
) =>
  conversation?.status === "ACCEPTED" ||
  (conversation?.status === "PENDING" &&
    conversation.initiatedBy?.toString() === userId.toString() &&
    !hasRequestMessage);

export const loadAuthorizedConversation = async (
  conversationId,
  userId,
  { requireAccepted = false } = {},
) => {
  if (!mongoose.isValidObjectId(conversationId)) {
    throw new MessagingError(400, "Invalid conversation ID");
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new MessagingError(404, "Conversation not found");
  }

  if (!isConversationParticipant(conversation.participants, userId)) {
    throw new MessagingError(403, "You are not part of this conversation");
  }

  if (requireAccepted && conversation.status !== "ACCEPTED") {
    throw new MessagingError(
      403,
      "You cannot send messages until the conversation request is accepted",
    );
  }

  const receiverId = conversation.participants.find(
    (participant) => participant.toString() !== userId.toString(),
  );
  if (!receiverId) {
    throw new MessagingError(400, "Conversation participants are invalid");
  }

  const [sender, receiver] = await Promise.all([
    User.findById(userId).select("isRestricted role"),
    User.findById(receiverId).select("isRestricted role"),
  ]);
  if (!sender || !receiver) {
    throw new MessagingError(404, "Conversation participant not found");
  }
  if (sender.role !== "student" || receiver.role !== "student") {
    throw new MessagingError(403, "Messaging is limited to student accounts");
  }
  if (sender.isRestricted || receiver.isRestricted) {
    throw new MessagingError(403, "Messaging is unavailable for this account");
  }
  const block = await VibeCheckInteraction.exists({
    action: "BLOCK",
    $or: [
      { actor: userId, target: receiverId },
      { actor: receiverId, target: userId },
    ],
  });
  if (block) {
    throw new MessagingError(403, "Messaging is unavailable for this conversation");
  }

  return { conversation, receiverId };
};

export const persistDirectMessage = async ({
  conversation,
  senderId,
  receiverId,
  content,
  clientMessageId,
  isRequestMessage = false,
}) => {
  if (typeof content !== "string") {
    throw new MessagingError(400, "Message must be text");
  }
  const message = content.trim();
  if (!message || message.length > 2000) {
    throw new MessagingError(
      400,
      "Message must contain between 1 and 2000 characters",
    );
  }
  if (
    typeof clientMessageId !== "string" ||
    !/^[\w-]{1,100}$/.test(clientMessageId)
  ) {
    throw new MessagingError(400, "A valid client message ID is required");
  }

  const existing = await DirectMessage.findOne({
    conversation: conversation._id,
    sender: senderId,
    clientMessageId,
  });
  let savedMessage = existing;
  if (!savedMessage) {
    try {
      savedMessage = await DirectMessage.create({
        conversation: conversation._id,
        sender: senderId,
        receiver: receiverId,
        message,
        messageType: "TEXT",
        clientMessageId,
        isRequestMessage,
      });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
      savedMessage = await DirectMessage.findOne({
        conversation: conversation._id,
        sender: senderId,
        clientMessageId,
      });
      if (!savedMessage && isRequestMessage) {
        throw new MessagingError(
          409,
          "A message request can include only one introductory message.",
        );
      }
      if (!savedMessage) throw error;
    }
  }

  await Conversation.findByIdAndUpdate(conversation._id, {
    $set: {
      lastMessage: savedMessage._id,
      lastMessageAt: savedMessage.createdAt,
    },
  });

  return DirectMessage.findById(savedMessage._id).populate(
    "sender",
    "name profile.avatar",
  );
};
