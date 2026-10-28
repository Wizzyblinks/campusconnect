import express from "express";
import { changePassword, getProfile, updateProfile } from "../controllers/profileController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getProfile);
router.patch("/", protect, updateProfile);
router.patch("/password", protect, changePassword);

export default router;
