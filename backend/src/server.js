import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import groupChatService from "./services/groupChatService.js";
import directMessageSocketService from "./services/directMessageSocketService.js";
import Conversation from "./models/Conversation.js";

const PORT = process.env.PORT || 5000;

await connectDB();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.set("io", io);

const activeSocketCounts = new Map();
const syncPresence = async (userId) => {
  try {
    let online = (activeSocketCounts.get(userId.toString()) || 0) > 0;
    while (true) {
      await User.findByIdAndUpdate(userId, { $set: { isOnline: online } });
      const current = (activeSocketCounts.get(userId.toString()) || 0) > 0;
      if (current === online) {
        await broadcastPresence(userId, online);
        return;
      }
      online = current;
    }
  } catch (error) {
    console.error("Online presence update failed:", error.message);
  }
};

const broadcastPresence = async (userId, isOnline) => {
  try {
    const conversations = await Conversation.find({
      participants: userId,
    }).select("participants");
    const recipientIds = new Set();
    conversations.forEach((conversation) => {
      conversation.participants.forEach((participant) => {
        if (participant.toString() !== userId.toString()) {
          recipientIds.add(participant.toString());
        }
      });
    });
    for (const recipientId of recipientIds) {
      io.to(`user:${recipientId}`).emit("presence:update", {
        userId: userId.toString(),
        isOnline,
      });
    }
  } catch (error) {
    console.error("Presence broadcast failed:", error.message);
  }
};

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("User not found"));
    }

    if ((user.tokenVersion || 0) !== (decoded.tokenVersion ?? 0)) {
      return next(new Error("Session expired. Please log in again."));
    }

    if (user.emailVerified === false) {
      return next(new Error("Email verification is required"));
    }

    if (user.isRestricted) {
      return next(new Error("Your account is restricted"));
    }

    socket.user = user;

    next();
  } catch (error) {
    next(new Error("Invalid authentication token"));
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  const userId = socket.user._id.toString();
  const connectionCount = activeSocketCounts.get(userId) || 0;
  activeSocketCounts.set(userId, connectionCount + 1);
  if (connectionCount === 0) {
    syncPresence(userId);
  }

  groupChatService(io, socket);
  directMessageSocketService(io, socket);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    const remaining = (activeSocketCounts.get(userId) || 1) - 1;
    if (remaining > 0) {
      activeSocketCounts.set(userId, remaining);
      return;
    }
    activeSocketCounts.delete(userId);
    syncPresence(userId);
  });
});

server.listen(PORT, () => {
  console.log(`Campus Connect server running on port ${PORT}`);
});
