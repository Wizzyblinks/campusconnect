import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getBanks, getMyPayouts, savePayoutAccount } from "../controllers/payoutController.js";

const router = express.Router();
router.get("/banks", protect, getBanks);
router.get("/me", protect, getMyPayouts);
router.put("/account", protect, savePayoutAccount);
export default router;
