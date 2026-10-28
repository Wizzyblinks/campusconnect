import express from "express";
import multer from "multer";
import protect from "../middleware/authMiddleware.js";
import uploadPostMedia from "../middleware/postUploadMiddleware.js";
import {
  createPost,
  createPostComment,
  deletePost,
  deletePostComment,
  getFeedPosts,
  getPost,
  getPostComments,
  likePost,
  reportPost,
  sharePost,
  unlikePost,
  updatePost,
  updatePostComment,
} from "../controllers/postController.js";

const router = express.Router();

router.get("/", protect, getFeedPosts);
router.get("/:id/comments", protect, getPostComments);
router.post("/:id/comments", protect, createPostComment);
router.post("/:id/like", protect, likePost);
router.delete("/:id/like", protect, unlikePost);
router.post("/:id/share", protect, sharePost);
router.post("/:id/report", protect, reportPost);
router.post("/", protect, uploadPostMedia.single("media"), createPost);
router.patch("/:id", protect, uploadPostMedia.single("media"), updatePost);
router.delete("/:id", protect, deletePost);
router.get("/:id", protect, getPost);
router.patch("/comments/:commentId", protect, updatePostComment);
router.delete("/comments/:commentId", protect, deletePostComment);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Videos must be 100 MB or smaller. Please choose a smaller file."
      : "Choose one supported image or video to attach to your post.";
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message });
  }
  if (error.message === "Unsupported post media type") {
    return res.status(400).json({ message: "Choose a JPG, PNG, GIF, WebP, MP4, or WebM file." });
  }
  return next(error);
});

export default router;
