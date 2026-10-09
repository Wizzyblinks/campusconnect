import express from "express";

import {
  createDispute,
  getMyDisputes,
  getDisputeById,
  resolveDispute,
} from "../controllers/disputeController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:orderId", protect, createDispute);

router.get("/", protect, getMyDisputes);

router.get("/:id", protect, getDisputeById);

router.patch("/:id/resolve", protect, resolveDispute);

export default router;
