import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";

const isGroupMember = async (groupId, userId) => {
  const group = await Group.findById(groupId);

  if (!group) {
    return null;
  }

  const member = group.members.find(
    (member) => member.user.toString() === userId.toString(),
  );

  return member ? group : null;
};

const groupChatService = (io, socket) => {
  socket.on("group:join", async ({ groupId }) => {
    try {
      const userId = socket.user._id;

      const group = await isGroupMember(groupId, userId);

      if (!group) {
        return socket.emit("group:error", {
          message: "You are not a member of this group",
        });
      }

      socket.join(`group:${groupId}`);

      socket.emit("group:joined", {
        message: "Joined group chat successfully",
        groupId,
      });
    } catch (error) {
      socket.emit("group:error", {
        message: "Failed to join group chat",
      });
    }
  });

  socket.on("group:message", async ({ groupId, message }) => {
    try {
      if (!message || !message.trim()) {
        return socket.emit("group:error", {
          message: "Message cannot be empty",
        });
      }

      const group = await isGroupMember(groupId, socket.user._id);

      if (!group) {
        return socket.emit("group:error", {
          message: "You are not a member of this group",
        });
      }

      const newMessage = await GroupMessage.create({
        group: groupId,
        sender: socket.user._id,
        message: message.trim(),
        messageType: "TEXT",
      });

      const populatedMessage = await GroupMessage.findById(
        newMessage._id,
      ).populate("sender", "name email profile.avatar");

      io.to(`group:${groupId}`).emit("group:message", {
        message: populatedMessage,
      });
    } catch (error) {
      socket.emit("group:error", {
        message: "Failed to send message",
      });
    }
  });

  socket.on("group:leave", ({ groupId }) => {
    socket.leave(`group:${groupId}`);

    socket.emit("group:left", {
      message: "Left group chat successfully",
      groupId,
    });
  });
};

export default groupChatService;
