import express from "express";
import protect from "../middleware/authMiddleware.js";
import { searchCampusConnect } from "../controllers/searchController.js";
import { getTrending } from "../controllers/trendingController.js";

const router = express.Router();
router.get("/", protect, searchCampusConnect);
router.get("/trending", protect, getTrending);
export default router;
