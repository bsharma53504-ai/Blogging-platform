import { Router } from "express";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { protect } from "../middleware/auth.js";

const router = Router();
const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(here, "..", process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      const error = new Error("Only JPEG, PNG, WebP, or GIF images are allowed.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

router.post("/", protect, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Choose an image to upload." });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

export default router;
