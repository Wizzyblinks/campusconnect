import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getPublicProfile, getStudentSuggestions } from "../controllers/discoveryController.js";

const router = express.Router();
router.get("/students", protect, getStudentSuggestions);
router.get("/profiles/:id", protect, getPublicProfile);
export default router;
