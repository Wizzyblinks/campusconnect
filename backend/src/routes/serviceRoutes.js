import express from "express";
import multer from "multer";
import {
  createService,
  createServiceRequest,
  deleteService,
  getAdminServices,
  getAdminServiceRequests,
  getMyServices,
  getMyServiceRequests,
  getServices,
  reviewServiceRequest,
  updateService,
} from "../controllers/serviceController.js";
import adminOnly from "../middleware/adminMiddleware.js";
import protect from "../middleware/authMiddleware.js";
import uploadServiceImage from "../middleware/serviceImageUploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getServices);
router.get("/mine", getMyServices);
router.get("/requests", getMyServiceRequests);
router.post("/requests", uploadServiceImage.single("image"), createServiceRequest);
router.get("/admin/requests", adminOnly, getAdminServiceRequests);
router.patch("/admin/requests/:id", adminOnly, reviewServiceRequest);
router.get("/admin", adminOnly, getAdminServices);
router.post("/", adminOnly, uploadServiceImage.single("image"), createService);
router.patch(
  "/:id",
  uploadServiceImage.single("image"),
  updateService,
);
router.delete("/:id", deleteService);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "Service images must be 5 MB or smaller",
      });
    }
    return res.status(400).json({ message: "Service image upload failed" });
  }
  if (error.message === "Unsupported service image type") {
    return res.status(400).json({ message: "Choose a JPG, PNG, or WebP service image." });
  }
  return next(error);
});

export default router;
