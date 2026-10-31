import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import { canAccessGroup, isGroupMember } from "./groupAccess.js";
import { PUBLIC_PROFILE_FIELDS } from "./publicProfileProjection.js";

const findActiveMemberGroup = async (groupId, user) => {
  const group = await Group.findById(groupId);

  if (
    !group ||
    group.status !== "ACTIVE" ||
    !canAccessGroup(group, user) ||
    !isGroupMember(group, user._id)
  ) {
    return null;
  }

  return group;
};

const groupChatService = (io, socket) => {
  socket.on("group:join", async ({ groupId }) => {
    try {
      const group = await findActiveMemberGroup(groupId, socket.user);

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

      const group = await findActiveMemberGroup(groupId, socket.user);

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
      ).populate("sender", PUBLIC_PROFILE_FIELDS);

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
