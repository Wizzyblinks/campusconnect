import express from "express";

import {
  initializePayment,
  confirmPayment,
  getPaymentByOrder,
} from "../controllers/paymentController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/initialize", protect, initializePayment);

router.post("/confirm", protect, confirmPayment);

router.get("/order/:orderId", protect, getPaymentByOrder);

export default router;
