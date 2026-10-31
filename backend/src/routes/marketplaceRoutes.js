import express from "express";
import multer from "multer";

import {
  createListing,
  getMarketplaceListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing,
} from "../controllers/marketplaceController.js";
import {
  getSellerApplicationStatus,
  submitSellerApplication,
} from "../controllers/sellerApplicationController.js";

import protect from "../middleware/authMiddleware.js";
import requireSeller from "../middleware/requireSeller.js";
import uploadMarketplaceMedia from "../middleware/marketplaceUploadMiddleware.js";

const router = express.Router();

router.get("/seller-status", protect, getSellerApplicationStatus);
router.post("/seller-application", protect, submitSellerApplication);
router.post("/", protect, requireSeller, uploadMarketplaceMedia.array("media", 4), createListing);

router.get("/", protect, getMarketplaceListings);

router.get("/mine", protect, requireSeller, getMyListings);

router.get("/:id", protect, getListingById);

router.patch("/:id", protect, requireSeller, uploadMarketplaceMedia.array("media", 4), updateListing);

router.delete("/:id", protect, requireSeller, deleteListing);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "Each marketplace image must be 25 MB or smaller",
      });
    }

    if (
      error.code === "LIMIT_FILE_COUNT" ||
      error.code === "LIMIT_UNEXPECTED_FILE"
    ) {
      return res.status(400).json({
        message: "You can upload a maximum of four marketplace images",
      });
    }

    return res.status(400).json({
      message: "Marketplace image upload failed",
    });
  }

  if (error.message === "Only image files are allowed") {
    return res.status(400).json({
      message: error.message,
    });
  }

  return next(error);
});

export default router;
