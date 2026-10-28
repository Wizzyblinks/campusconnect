import multer from "multer";

const uploadPostMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Unsupported post media type"));
  },
});

export default uploadPostMedia;
