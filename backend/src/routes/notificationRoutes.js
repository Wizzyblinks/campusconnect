import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect);
router.get("/", getMyNotifications);
router.patch("/read", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;
