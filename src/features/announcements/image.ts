/** Hard limit of an uploaded image, also set on the `announcement-images` bucket (migration announcements_v2). */
export const IMAGE_MAX_BYTES = 300 * 1024;

/** Size the browser aims for when it compresses: under the hard limit, so a little variation never breaks it. */
export const IMAGE_TARGET_BYTES = 220 * 1024;

/** Longest side, in pixels, of a compressed image (a phone screen is about 1200 px wide at most). */
export const IMAGE_MAX_SIDE = 1600;

/** Smallest longest side the compressor goes down to before giving up. */
export const IMAGE_MIN_SIDE = 640;

/** Largest dimension accepted by the database (`announcements_image_*_range`). */
export const IMAGE_MAX_DIMENSION = 4000;

export type ImageType = "webp" | "jpg";

/**
 * Detects the real format of a file from its first bytes (never from its name or declared type, which a client
 * controls). Only WebP and JPEG are accepted.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (offset: number, text: string) =>
    [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  if (bytes.length >= 12 && startsWith(0, "RIFF") && startsWith(8, "WEBP")) return "webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpg";
  return null;
}

/** Scales a size down so that its longest side is at most `maxSide` (never up), keeping the ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Public URL of an image of the `announcement-images` bucket. */
export function announcementImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/announcement-images/${path}`;
}
