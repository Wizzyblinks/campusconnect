import express from "express";

import protect from "../middleware/authMiddleware.js";

import {
  startConversation,
  acceptConversation,
  declineConversation,
  reportConversation,
  sendDirectMessage,
  getMyConversations,
  getConversationMessages,
} from "../controllers/messageController.js";

const router = express.Router();

router.post("/conversations", protect, startConversation);

router.get("/conversations", protect, getMyConversations);

router.get(
  "/conversations/:conversationId/messages",
  protect,
  getConversationMessages,
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
