import express from "express";
import multer from "multer";
import {
  createService,
  deleteService,
  getAdminServices,
  getServices,
  updateService,
} from "../controllers/serviceController.js";
import adminOnly from "../middleware/adminMiddleware.js";
import protect from "../middleware/authMiddleware.js";
import uploadServiceImage from "../middleware/serviceImageUploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getServices);
router.get("/admin", adminOnly, getAdminServices);
router.post("/", adminOnly, uploadServiceImage.single("image"), createService);
router.patch(
  "/:id",
  adminOnly,
  uploadServiceImage.single("image"),
  updateService,
);
router.delete("/:id", adminOnly, deleteService);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "Service images must be 5 MB or smaller",
      });
    }
    return res.status(400).json({ message: "Service image upload failed" });
  }
  if (error.message === "Only image files are allowed") {
    return res.status(400).json({ message: error.message });
  }
  return next(error);
});

export default router;
