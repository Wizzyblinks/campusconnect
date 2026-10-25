import express from "express";
import {
  getAdminOverview,
  getAdminUsers,
  getMessageReports,
  reviewMessageReport,
  setUserRestriction,
} from "../controllers/adminController.js";
import adminOnly from "../middleware/adminMiddleware.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/overview", getAdminOverview);
router.get("/users", getAdminUsers);
router.patch("/users/:id/restriction", setUserRestriction);
router.get("/reports/messages", getMessageReports);
router.patch("/reports/messages/:id", reviewMessageReport);

export default router;
