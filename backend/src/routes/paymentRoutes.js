import express from "express";

import {
  initializePayment,
  confirmPayment,
  getPaymentByOrder,
  getPaymentByReference,
  handleFlutterwaveWebhook,
} from "../controllers/paymentController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/initialize", protect, initializePayment);

router.post("/confirm", protect, confirmPayment);

router.post("/webhook", handleFlutterwaveWebhook);

router.get("/order/:orderId", protect, getPaymentByOrder);

router.get("/reference/:reference", protect, getPaymentByReference);

export default router;
