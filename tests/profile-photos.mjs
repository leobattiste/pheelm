import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareProfilePhoto, avatarObjectPath, MAX_PHOTO_BYTES } from "../lib/profile-photo.ts";

for (const format of ["jpeg", "png", "webp"]) {
  const image = await sharp({ create: { width: 640, height: 900, channels: 3, background: "#4682b4" } }).toFormat(format).withMetadata().toBuffer();
  const result = await prepareProfilePhoto(new File([image], `photo.${format}`, { type: `image/${format}` }));
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.width, 512); assert.equal(meta.height, 512);
  assert.equal(meta.exif, undefined); assert.equal(meta.icc, undefined);
}
await assert.rejects(() => prepareProfilePhoto(new File(["not an image"], "photo.png", { type: "image/png" })));
await assert.rejects(() => prepareProfilePhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "photo.jpg", { type: "image/jpeg" })));
await assert.rejects(() => prepareProfilePhoto(new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" })));
await assert.rejects(() => prepareProfilePhoto(new File([], "empty.png", { type: "image/png" })));
const disguised = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).tiff().toBuffer();
await assert.rejects(() => prepareProfilePhoto(new File([disguised], "photo.png", { type: "image/png" })));
const prefix = "https://mvhwfmlairwrngdttzjh.supabase.co/storage/v1/object/public/avatars/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/";
assert.equal(avatarObjectPath(`${prefix}bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp`, prefix), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp");
assert.equal(avatarObjectPath(prefix.replace("aaaaaaaa", "cccccccc") + "photo.webp", prefix), null);
assert.equal(avatarObjectPath(`${prefix}../other/photo.webp`, prefix), null);
assert.equal(avatarObjectPath("https://example.com/photo.webp", prefix), null);
console.log("Passed profile photo processing, size/type validation, metadata stripping, and owner-only cleanup paths.");
