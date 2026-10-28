import Notification from "../models/Notification.js";

export const emitNotification = (io, recipient, notification) => {
  io?.to(`user:${recipient}`).emit("notification:new", { notification });
};

export const notificationOwnerFilter = (recipientId, notificationId) => ({
  _id: notificationId,
  recipient: recipientId,
});

export const createNotification = async ({
  io,
  recipient,
  actor,
  type,
  title,
  message,
  targetType,
  targetId,
  sourceId,
}) => {
  let notification;
  try {
    notification = await Notification.findOneAndUpdate(
      { recipient, sourceId, type },
      {
        $setOnInsert: {
          recipient,
          actor,
          type,
          title,
          message,
          targetType,
          targetId,
          sourceId,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    notification = await Notification.findOne({ recipient, sourceId, type });
  }
  if (!notification) {
    throw new Error("The notification could not be saved.");
  }
  const populatedNotification = await Notification.findById(notification._id)
    .populate("actor", "name profile.avatar")
    .lean();

  emitNotification(io, recipient, populatedNotification);

  return populatedNotification;
};

export const safelyCreateNotification = async (options) => {
  try {
    await createNotification(options);
  } catch (error) {
    console.error("Notification creation failed:", error.message);
  }
};
