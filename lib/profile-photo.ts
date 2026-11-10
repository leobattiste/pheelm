import sharp from "sharp";

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/** Decode the actual image, normalize orientation, crop and strip metadata. */
export async function prepareProfilePhoto(file: File): Promise<Buffer> {
  if (!file.size || file.size > MAX_PHOTO_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image up to 3 MB.");
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("Unsupported image");
    return await image.rotate().resize(512, 768, { fit: "cover", position: "attention" }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new Error("That image couldn't be opened. Choose another JPG, PNG or WebP.");
  }
}

/** Only delete objects belonging to this user in our avatar bucket. */
export function avatarObjectPath(url: string | null, prefix: string): string | null {
  if (!url?.startsWith(prefix)) return null;
  const file = url.slice(prefix.length);
  return /^[0-9a-f-]+\.webp$/.test(file) ? `${new URL(prefix).pathname.split("/").filter(Boolean).at(-1)}/${file}` : null;
}
