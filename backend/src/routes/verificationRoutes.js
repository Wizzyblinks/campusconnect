import express from "express";

import {
  submitVerification,
  getVerificationStatus,
  getPendingVerifications,
  reviewVerification,
} from "../controllers/verificationController.js";

import protect from "../middleware/authMiddleware.js";
import adminOnly from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/", protect, upload.single("document"), submitVerification);

router.get("/status", protect, getVerificationStatus);

router.get("/admin/pending", protect, adminOnly, getPendingVerifications);

router.patch("/admin/:id", protect, adminOnly, reviewVerification);

export default router;
