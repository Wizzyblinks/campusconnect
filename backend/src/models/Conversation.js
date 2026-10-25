import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    participantPair: {
      type: String,
      select: false,
    },

    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED", "REPORTED"],
      default: "PENDING",
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    reportReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderationStatus: {
      type: String,
      enum: ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"],
      default: "OPEN",
    },
    moderationNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({
  participants: 1,
});

conversationSchema.index({
  status: 1,
});

conversationSchema.index({
  lastMessageAt: -1,
});
conversationSchema.index(
  { participantPair: 1 },
  { unique: true, sparse: true },
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
