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

/**
 * Going private has to move the profile photo. The avatars bucket is public, so the old address
 * keeps working for anyone who already has it; copying the file to a fresh random name and
 * deleting the original is what actually retires that link.
 *
 * Returns the new photo address to save, or `failed` when the move did not happen — the caller
 * must then say so rather than reporting a clean save, because the old photo is still reachable.
 */
export async function photoForPrivacyChange(
  db: { storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }>; upload: (p: string, f: Blob, o?: Record<string, unknown>) => Promise<{ error: unknown }>; getPublicUrl: (p: string) => { data: { publicUrl: string } } } } },
  userId: string,
  { goingPrivate, photo }: { goingPrivate: boolean; photo: string | null | undefined },
): Promise<{ url: string; old: string; path: string } | { failed: true } | null> {
  if (!goingPrivate || !photo) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const at = photo.indexOf(marker);
  if (at < 0) return null;
  const old = decodeURIComponent(photo.slice(at + marker.length).split("?")[0]);
  if (!old.startsWith(`${userId}/`)) return null;
  const { data: file, error: readError } = await db.storage.from("avatars").download(old);
  if (readError || !file) return { failed: true };
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await db.storage.from("avatars").upload(path, file, { contentType: "image/webp", upsert: false });
  if (error) return { failed: true };
  return { old, path, url: db.storage.from("avatars").getPublicUrl(path).data.publicUrl };
}

/** Narrows what `photoForPrivacyChange` returned to a move that worked. */
export const photoMoved = (r: Awaited<ReturnType<typeof photoForPrivacyChange>>): r is { url: string; old: string; path: string } =>
  !!r && !("failed" in r);
