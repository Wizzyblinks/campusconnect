import express from "express";
import {
  actOnProfile,
  getVibeCheckReports,
  getDiscovery,
  reportProfile,
  reviewVibeCheckReport,
  updatePreferences,
} from "../controllers/matchingController.js";
import protect from "../middleware/authMiddleware.js";
import adminOnly from "../middleware/adminMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getDiscovery);
router.patch("/preferences", updatePreferences);
router.post("/profiles/:profileId/actions", actOnProfile);
router.post("/profiles/:profileId/report", reportProfile);
router.get("/admin/reports", adminOnly, getVibeCheckReports);
router.patch(
  "/admin/reports/:reportId",
  adminOnly,
  reviewVibeCheckReport,
);

export default router;
