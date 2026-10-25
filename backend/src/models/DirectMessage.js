import mongoose from "mongoose";

const directMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    clientMessageId: {
      type: String,
      maxlength: 100,
    },

    messageType: {
      type: String,
      enum: ["TEXT", "IMAGE"],
      default: "TEXT",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

directMessageSchema.index({
  conversation: 1,
  createdAt: -1,
});
directMessageSchema.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  },
);

const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);

export default DirectMessage;
