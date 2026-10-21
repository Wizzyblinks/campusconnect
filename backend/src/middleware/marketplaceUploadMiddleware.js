import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";

const uploadDirectory = path.resolve("uploads/marketplace");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, callback) => {
    const safeExtension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
  },
});

const uploadMarketplaceMedia = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image and video files are allowed"));
  },
});

export default uploadMarketplaceMedia;
