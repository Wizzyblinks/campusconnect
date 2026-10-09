import express from "express";

import groupUpload from "../middleware/groupUploadMiddleware.js";

import {
  createGroup,
  getGroups,
  getGroupById,
  getGroupMessages,
  deleteGroupMessage,
  sendGroupImage,
  joinGroup,
  leaveGroup,
  appointAdmin,
  removeAdmin,
  removeMember,
  transferOwnership,
} from "../controllers/groupController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createGroup);

router.get("/", protect, getGroups);

router.get("/:id", protect, getGroupById);

router.get("/:id/messages", protect, getGroupMessages);

router.post(
  "/:id/messages/image",
  protect,
  groupUpload.single("image"),
  sendGroupImage,
);

router.delete("/:id/messages/:messageId", protect, deleteGroupMessage);

router.post("/:id/join", protect, joinGroup);

router.post("/:id/leave", protect, leaveGroup);

router.patch("/:id/appoint-admin", protect, appointAdmin);

router.patch("/:id/remove-admin", protect, removeAdmin);

router.patch("/:id/remove-member", protect, removeMember);

router.patch("/:id/transfer-ownership", protect, transferOwnership);

export default router;
