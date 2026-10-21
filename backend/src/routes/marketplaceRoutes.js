import express from "express";

import {
  createListing,
  getMarketplaceListings,
  getListingById,
  updateListing,
  deleteListing,
} from "../controllers/marketplaceController.js";

import protect from "../middleware/authMiddleware.js";
import uploadMarketplaceMedia from "../middleware/marketplaceUploadMiddleware.js";

const router = express.Router();

router.post("/", protect, uploadMarketplaceMedia.array("media", 4), createListing);

router.get("/", protect, getMarketplaceListings);

router.get("/:id", protect, getListingById);

router.patch("/:id", protect, updateListing);

router.delete("/:id", protect, deleteListing);

export default router;
