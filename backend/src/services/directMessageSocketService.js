import DirectMessage from "../models/DirectMessage.js";
import {
  loadAuthorizedConversation,
  canSendInConversation,
  MessagingError,
  persistDirectMessage,
} from "./directMessageService.js";
import { safelyCreateNotification } from "./notificationService.js";

const emitError = (socket, acknowledge, error) => {
  const payload = {
    message: error instanceof MessagingError ? error.message : "Messaging request failed",
  };
  socket.emit("dm:error", payload);
  if (typeof acknowledge === "function") {
    acknowledge({ error: payload.message });
  }
};

const directMessageSocketService = (io, socket) => {
  const userId = socket.user._id;
  socket.join(`user:${userId}`);

  socket.on("dm:join", async (payload = {}, acknowledge) => {
    try {
      const { conversationId } = payload;
      const { conversation } = await loadAuthorizedConversation(
        conversationId,
        userId,
      );
      if (!["ACCEPTED", "PENDING"].includes(conversation.status)) {
        throw new MessagingError(403, "This conversation request is no longer available.");
      }
      await socket.join(`conversation:${conversation._id}`);
      if (typeof acknowledge === "function") {
        acknowledge({ conversationId: conversation._id.toString() });
      }
    } catch (error) {
      emitError(socket, acknowledge, error);
    }
  });

  socket.on("dm:leave", (payload = {}) => {
    if (typeof payload.conversationId === "string") {
      socket.leave(`conversation:${payload.conversationId}`);
    }
  });

  socket.on("dm:send", async (payload = {}, acknowledge) => {
    try {
      const { conversationId, message, clientMessageId } = payload;
      const { conversation, receiverId } = await loadAuthorizedConversation(
        conversationId,
        userId,
      );
      const hasRequestMessage = conversation.status === "PENDING"
        ? Boolean(await DirectMessage.exists({
            conversation: conversation._id,
            isRequestMessage: true,
          }))
        : false;
      const isRequestMessageRetry = conversation.status === "PENDING"
        ? Boolean(await DirectMessage.exists({
            conversation: conversation._id,
            sender: userId,
            clientMessageId,
            isRequestMessage: true,
          }))
        : false;
      if (
        !canSendInConversation(conversation, userId, hasRequestMessage) &&
        !isRequestMessageRetry
      ) {
        throw new MessagingError(
          403,
          "You can send one introductory message with a request; further messages require acceptance.",
        );
      }
      const savedMessage = await persistDirectMessage({
        conversation,
        senderId: userId,
        receiverId,
        content: message,
        clientMessageId,
        isRequestMessage: conversation.status === "PENDING",
      });
      await safelyCreateNotification({
        io,
        recipient: receiverId,
        actor: userId,
        type: "direct_message",
        title: `${socket.user.name} sent you a message`,
        message: "Open the conversation to read it.",
        targetType: "conversation",
        targetId: conversation._id,
        sourceId: conversation.status === "PENDING"
          ? conversation._id
          : savedMessage._id,
      });
      const event = {
        conversationId: conversation._id.toString(),
        message: savedMessage,
      };
      io
        .to(`conversation:${conversation._id}`)
        .to(`user:${receiverId}`)
        .emit("dm:new", event);
      if (typeof acknowledge === "function") {
        acknowledge({ message: savedMessage });
      }
    } catch (error) {
      emitError(socket, acknowledge, error);
    }
  });

  socket.on("dm:read", async (payload = {}, acknowledge) => {
    try {
      const { conversationId } = payload;
      const { conversation } = await loadAuthorizedConversation(
        conversationId,
        userId,
      );
      await DirectMessage.updateMany(
        {
          conversation: conversation._id,
          receiver: userId,
          isRead: false,
        },
        { $set: { isRead: true } },
      );
      const event = {
        conversationId: conversation._id.toString(),
        readerId: userId,
      };
      io
        .to(`conversation:${conversation._id}`)
        .to(`user:${userId}`)
        .emit("dm:read", event);
      if (typeof acknowledge === "function") {
        acknowledge({ success: true });
      }
    } catch (error) {
      emitError(socket, acknowledge, error);
    }
  });
};

export default directMessageSocketService;
