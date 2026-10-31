import express from "express";
import protect from "../middleware/authMiddleware.js";
import requireSeller from "../middleware/requireSeller.js";
import { getBanks, getMyPayouts, savePayoutAccount } from "../controllers/payoutController.js";

const router = express.Router();
router.get("/banks", protect, getBanks);
router.get("/me", protect, requireSeller, getMyPayouts);
router.put("/account", protect, requireSeller, savePayoutAccount);
export default router;
