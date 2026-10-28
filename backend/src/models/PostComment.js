import mongoose from "mongoose";

const postCommentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "PostComment", default: null },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

postCommentSchema.index({ post: 1, createdAt: -1 });
postCommentSchema.index({ parent: 1, createdAt: 1 });

export default mongoose.model("PostComment", postCommentSchema);
