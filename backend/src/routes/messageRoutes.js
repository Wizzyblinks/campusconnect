import express from "express";
import mongoose from "mongoose";

import protect from "../middleware/authMiddleware.js";

import {
  startConversation,
  acceptConversation,
  declineConversation,
  reportConversation,
  sendDirectMessage,
  getMyConversations,
  getConversationMessages,
  markConversationRead,
  searchMessageRecipients,
} from "../controllers/messageController.js";

const router = express.Router();

router.param("conversationId", (req, res, next, conversationId) => {
  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ message: "Invalid conversation ID" });
  }
  return next();
});

router.get("/users", protect, searchMessageRecipients);

router.post("/conversations", protect, startConversation);

router.get("/conversations", protect, getMyConversations);

router.get(
  "/conversations/:conversationId/messages",
  protect,
  getConversationMessages,
);

router.patch(
  "/conversations/:conversationId/read",
  protect,
  markConversationRead,
);

router.patch(
  "/conversations/:conversationId/accept",
  protect,
  acceptConversation,
);

router.patch(
  "/conversations/:conversationId/decline",
  protect,
  declineConversation,
);

router.patch(
  "/conversations/:conversationId/report",
  protect,
  reportConversation,
);

router.post(
  "/conversations/:conversationId/messages",
  protect,
  sendDirectMessage,
);

export default router;
