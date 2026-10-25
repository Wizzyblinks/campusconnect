import DirectMessage from "../models/DirectMessage.js";
import {
  loadAuthorizedConversation,
  MessagingError,
  persistDirectMessage,
} from "./directMessageService.js";

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
        { requireAccepted: true },
      );
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
        { requireAccepted: true },
      );
      const savedMessage = await persistDirectMessage({
        conversation,
        senderId: userId,
        receiverId,
        content: message,
        clientMessageId,
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
