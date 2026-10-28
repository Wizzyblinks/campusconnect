import express from "express";
import protect from "../middleware/authMiddleware.js";
import { logoutSession } from "../controllers/sessionController.js";
import {
  register,
  login,
  verifySignupOtp,
  resendSignupOtp,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-signup-otp", verifySignupOtp);
router.post("/resend-signup-otp", resendSignupOtp);
router.post("/request-password-reset", requestPasswordReset);
router.post("/verify-password-reset-otp", verifyPasswordResetOtp);
router.post("/resend-password-reset-otp", resendPasswordResetOtp);
router.post("/reset-password", resetPassword);
router.post("/login", login);
router.post("/logout", protect, logoutSession);

export default router;
