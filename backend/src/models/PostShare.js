import mongoose from "mongoose";

const postShareSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

postShareSchema.index({ post: 1, user: 1 }, { unique: true });
postShareSchema.index({ post: 1, createdAt: -1 });

export default mongoose.model("PostShare", postShareSchema);
