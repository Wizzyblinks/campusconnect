import express from "express";
import multer from "multer";
import {
  changePassword,
  getProfile,
  requestEmailChange,
  updateProfile,
  uploadProfileAvatar,
  verifyEmailChange,
} from "../controllers/profileController.js";
import protect from "../middleware/authMiddleware.js";
import uploadAvatarImage from "../middleware/profileAvatarUploadMiddleware.js";

const router = express.Router();

router.get("/", protect, getProfile);
router.post("/avatar", protect, uploadAvatarImage.single("avatar"), uploadProfileAvatar);
router.patch("/", protect, updateProfile);
router.patch("/password", protect, changePassword);
router.post("/email-change", protect, requestEmailChange);
router.post("/email-change/verify", protect, verifyEmailChange);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      message: error.code === "LIMIT_FILE_SIZE"
        ? "Profile pictures must be 5 MB or smaller."
        : "Choose one supported profile picture.",
    });
  }
  if (error.message === "Unsupported profile image type") {
    return res.status(400).json({ message: "Choose a JPG, PNG, or WebP profile picture." });
  }
  return next(error);
});

export default router;
