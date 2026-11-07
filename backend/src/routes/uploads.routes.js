import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../lib/config.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { clientKey, rateLimit } from "../middleware/rateLimit.js";
import { detectImageType, isSafeUploadName, resolveUploadDir } from "../lib/images.js";

const router = Router();
const uploadDir = resolveUploadDir(config.uploadDir);
await mkdir(uploadDir, { recursive: true });

const maxBytes = config.maxUploadMb * 1024 * 1024;

// Files are buffered in memory, verified by magic bytes, and only then written
// to disk — invalid uploads never leave orphans behind.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1 },
});

function uploadSingle(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `Image is too large (max ${config.maxUploadMb} MB)`
        : error.code === "LIMIT_UNEXPECTED_FILE"
          ? 'Unexpected field. Send the image as "file".'
          : error.message;
    const wrapped = new Error(message);
    wrapped.status = 400;
    return next(wrapped);
  });
}

// ── Upload one image ──────────────────────────────────────────────────────
router.post(
  "/",
  requireAuth,
  requireStaff,
  rateLimit({
    windowMs: 10 * 60_000,
    max: 60,
    message: "Too many uploads, please try again later.",
    keyGenerator: clientKey,
  }),
  uploadSingle,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file received (field name: file)" });

    const detected = detectImageType(req.file.buffer);
    if (!detected) {
      return res.status(400).json({
        error: "Unsupported image. Allowed formats: JPEG, PNG, WebP.",
      });
    }

    const filename = `${randomUUID()}.${detected.ext}`;
    await writeFile(path.join(uploadDir, filename), req.file.buffer);

    return res.status(201).json({
      file: {
        url: `/api/uploads/${filename}`,
        filename,
        mime: detected.mime,
        size: req.file.size,
      },
    });
  }
);

// ── Serve an uploaded image ───────────────────────────────────────────────
router.get("/:filename", (req, res, next) => {
  const { filename } = req.params;
  if (!isSafeUploadName(filename)) {
    return res.status(404).json({ error: "Not found" });
  }

  return res.sendFile(path.join(uploadDir, filename), {
    headers: {
      "Content-Type": filename.endsWith(".png")
        ? "image/png"
        : filename.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  }, (error) => {
    if (!error) return undefined;
    if (error.code === "ENOENT") return res.status(404).json({ error: "Not found" });
    return next(error);
  });
});

export default router;
