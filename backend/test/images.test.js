import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectImageType,
  isSafeUploadName,
  resolveUploadDir,
} from "../src/lib/images.js";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const JPEG = Buffer.from("ffd8ffe000104a464946000101", "hex");
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 ", "ascii"),
]);

test("detects PNG, JPEG and WebP by magic bytes", () => {
  assert.deepEqual(detectImageType(PNG), { ext: "png", mime: "image/png" });
  assert.deepEqual(detectImageType(JPEG), { ext: "jpg", mime: "image/jpeg" });
  assert.deepEqual(detectImageType(WEBP), { ext: "webp", mime: "image/webp" });
});

test("rejects anything that is not a supported image", () => {
  assert.equal(detectImageType(Buffer.from("<html></html>")), null);
  assert.equal(detectImageType(Buffer.from("GIF89a")), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
  assert.equal(detectImageType("not a buffer"), null);
});

test("only UUID-like filenames are accepted when serving files", () => {
  assert.equal(isSafeUploadName("2820b148-dac5-41c5-a57c-a8b39e3dcae1.png"), true);
  assert.equal(isSafeUploadName("a1b2c3d4.webp"), true);
  assert.equal(isSafeUploadName("../../package.json"), false);
  assert.equal(isSafeUploadName("file.php"), false);
  assert.equal(isSafeUploadName("file.svg"), false);
  assert.equal(isSafeUploadName(""), false);
  assert.equal(isSafeUploadName(undefined), false);
});

test("upload directory resolves to an absolute path", () => {
  assert.equal(resolveUploadDir("uploads").startsWith("/"), true);
  assert.equal(resolveUploadDir("/var/data/uploads"), "/var/data/uploads");
  assert.equal(resolveUploadDir().startsWith("/"), true);
});
