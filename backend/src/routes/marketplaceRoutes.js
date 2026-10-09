import express from "express";

import {
  createListing,
  getMarketplaceListings,
  getListingById,
  updateListing,
  deleteListing,
} from "../controllers/marketplaceController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createListing);

router.get("/", protect, getMarketplaceListings);

router.get("/:id", protect, getListingById);

router.patch("/:id", protect, updateListing);

router.delete("/:id", protect, deleteListing);

export default router;
