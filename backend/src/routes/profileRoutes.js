import express from "express";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getProfile);
router.patch("/", protect, updateProfile);

export default router;
