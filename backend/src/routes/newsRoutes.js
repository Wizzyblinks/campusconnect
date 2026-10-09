import express from "express";
import { createNews, getCampusNews } from "../controllers/newsController.js";
import protect from "../middleware/authMiddleware.js";
import adminOnly from "../middleware/adminMiddleware.js";
const router = express.Router();

router.post("/", protect, adminOnly, createNews);
router.get("/campus", protect, getCampusNews);

export default router;
