import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Allowed image formats. Detection is based on magic bytes, not on the
 * client-provided Content-Type (which can lie).
 *
 *   JPEG : FF D8 FF
 *   PNG  : 89 50 4E 47 0D 0A 1A 0A
 *   WEBP : "RIFF" .... "WEBP"
 */
export const IMAGE_TYPES = {
  jpeg: {
    ext: "jpg",
    mime: "image/jpeg",
    matches: (buffer) =>
      buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  png: {
    ext: "png",
    mime: "image/png",
    matches: (buffer) =>
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  webp: {
    ext: "webp",
    mime: "image/webp",
    matches: (buffer) =>
      buffer.length > 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP",
  },
};

/** Returns `{ ext, mime }` for a supported image buffer, otherwise null. */
export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  for (const type of Object.values(IMAGE_TYPES)) {
    if (type.matches(buffer)) return { ext: type.ext, mime: type.mime };
  }
  return null;
}

export const ALLOWED_MIME_TYPES = Object.values(IMAGE_TYPES).map((type) => type.mime);

const SAFE_FILENAME = /^[a-zA-Z0-9_-]{8,64}\.(jpg|png|webp)$/;

export function isSafeUploadName(name) {
  return typeof name === "string" && SAFE_FILENAME.test(name);
}

const here = path.dirname(fileURLToPath(import.meta.url));

/** Resolves the upload directory (absolute), defaulting to `<backend>/uploads`. */
export function resolveUploadDir(configured) {
  if (!configured) return path.resolve(here, "../../uploads");
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}
