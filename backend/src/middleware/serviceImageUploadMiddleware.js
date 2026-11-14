import multer from "multer";

const uploadServiceImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Unsupported service image type"));
  },
});

export default uploadServiceImage;
