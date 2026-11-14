import mongoose from "mongoose";

const hiddenPostSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  },
  { timestamps: true },
);

hiddenPostSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.model("HiddenPost", hiddenPostSchema);
