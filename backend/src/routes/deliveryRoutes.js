import express from "express";

import {
  updateDeliveryStatus,
  verifyDelivery,
} from "../controllers/deliveryController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.patch("/:orderId/status", protect, updateDeliveryStatus);

router.post("/:orderId/verify", protect, verifyDelivery);

export default router;
