import mongoose from "mongoose";

const followRequestSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"],
      default: "PENDING",
      required: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

followRequestSchema.index({ follower: 1, following: 1 }, { unique: true });
followRequestSchema.index({ following: 1, status: 1, createdAt: -1 });
followRequestSchema.index({ follower: 1, status: 1, createdAt: -1 });

const FollowRequest = mongoose.model("FollowRequest", followRequestSchema);

export default FollowRequest;
