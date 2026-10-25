import express from "express";
import {
  createNews,
  deleteNews,
  getAdminNews,
  getCampusNews,
  updateNews,
} from "../controllers/newsController.js";
import protect from "../middleware/authMiddleware.js";
import adminOnly from "../middleware/adminMiddleware.js";
const router = express.Router();

router.post("/", protect, adminOnly, createNews);
router.get("/campus", protect, getCampusNews);
router.get("/admin", protect, adminOnly, getAdminNews);
router.patch("/:id", protect, adminOnly, updateNews);
router.delete("/:id", protect, adminOnly, deleteNews);

export default router;
