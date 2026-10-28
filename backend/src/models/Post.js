import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    visibility: {
      type: String,
      enum: ["public", "campus", "private"],
      default: "campus",
      index: true,
    },
    hashtags: {
      type: [String],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    media: {
      url: { type: String, default: "" },
      type: { type: String, enum: ["image", "video"], default: null },
      publicId: { type: String, default: "", select: false },
    },
  },
  { timestamps: true },
);

postSchema.index({ institution: 1, createdAt: -1 });
postSchema.index({ campus: 1, visibility: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });

export default mongoose.model("Post", postSchema);
