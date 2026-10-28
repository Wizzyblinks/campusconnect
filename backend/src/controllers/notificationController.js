import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { notificationOwnerFilter } from "../services/notificationService.js";

export const getMyNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .populate("actor", "name profile.avatar")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({
        recipient: req.user._id,
        readAt: null,
      }),
    ]);

    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Load notifications failed:", error.message);
    return res.status(500).json({
      message: "We couldn't load your notifications right now.",
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    req.app.get("io")?.to(`user:${req.user._id}`).emit("notification:read", {
      all: true,
      unreadCount: 0,
    });
    return res.json({ unreadCount: 0 });
  } catch (error) {
    console.error("Mark all notifications read failed:", error.message);
    return res.status(500).json({
      message: "We couldn't update your notifications right now.",
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "That notification link is invalid." });
    }

    const notification = await Notification.findOneAndUpdate(
      notificationOwnerFilter(req.user._id, req.params.id),
      { $set: { readAt: new Date() } },
      { new: true },
    )
      .populate("actor", "name profile.avatar")
      .lean();
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      readAt: null,
    });
    req.app.get("io")?.to(`user:${req.user._id}`).emit("notification:read", {
      notificationId: notification._id,
      unreadCount,
    });
    return res.json({ notification, unreadCount });
  } catch (error) {
    console.error("Mark notification read failed:", error.message);
    return res.status(500).json({
      message: "We couldn't update your notification right now.",
    });
  }
};
