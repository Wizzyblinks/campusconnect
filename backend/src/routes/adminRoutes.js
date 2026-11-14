import express from "express";
import {
  getAdminOverview,
  getAdminPosts,
  getAdminListings,
  getAdminUsers,
  getAdminDisputes,
  getMessageReports,
  getPostReports,
  reviewMessageReport,
  reviewPostReport,
  moderateAdminPost,
  moderateAdminListing,
  setUserRestriction,
} from "../controllers/adminController.js";
import adminOnly from "../middleware/adminMiddleware.js";
import protect from "../middleware/authMiddleware.js";
import {
  getSellerApplicationsForAdmin,
  reviewSellerApplication,
} from "../controllers/sellerApplicationController.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/overview", getAdminOverview);
router.get("/seller-applications", getSellerApplicationsForAdmin);
router.patch("/seller-applications/:id", reviewSellerApplication);
router.get("/users", getAdminUsers);
router.get("/posts", getAdminPosts);
router.delete("/posts/:id", moderateAdminPost);
router.get("/marketplace-listings", getAdminListings);
router.delete("/marketplace-listings/:id", moderateAdminListing);
router.patch("/users/:id/restriction", setUserRestriction);
router.get("/reports/messages", getMessageReports);
router.patch("/reports/messages/:id", reviewMessageReport);
router.get("/reports/posts", getPostReports);
router.patch("/reports/posts/:id", reviewPostReport);
router.get("/disputes", getAdminDisputes);

export default router;
