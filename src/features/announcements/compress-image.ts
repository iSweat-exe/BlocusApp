import {
  fitWithin,
  IMAGE_MAX_SIDE,
  IMAGE_MIN_SIDE,
  IMAGE_TARGET_BYTES,
  type ImageType,
} from "./image";

/** An image ready to upload. */
export type CompressedImage = { blob: Blob; width: number; height: number; type: ImageType };

/** Encodes the image at a size and a quality (0 to 1); resolves `null` when the browser cannot encode. */
export type Encoder = (width: number, height: number, quality: number) => Promise<Blob | null>;

const QUALITIES = [0.8, 0.68, 0.56, 0.45];

/**
 * Finds the largest version of an image that fits in `budget` bytes: tries the qualities from best to worst at
 * the current size, then shrinks the size by a fifth and starts again, until the longest side would go under
 * `IMAGE_MIN_SIDE`. Pure apart from the encoder it is given, so it is tested without a browser.
 * @returns The encoded image, or `null` when even the smallest and worst version is too big.
 */
export async function encodeWithinBudget(
  encode: Encoder,
  width: number,
  height: number,
  budget: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  let size = fitWithin(width, height, IMAGE_MAX_SIDE);
  for (;;) {
    for (const quality of QUALITIES) {
      const blob = await encode(size.width, size.height, quality);
      if (!blob) return null;
      if (blob.size <= budget) return { blob, ...size };
    }
    const next = fitWithin(
      size.width,
      size.height,
      Math.floor(Math.max(size.width, size.height) * 0.8),
    );
    if (Math.max(next.width, next.height) < IMAGE_MIN_SIDE) return null;
    size = next;
  }
}

/**
 * Compresses a photo in the browser before it is sent: scales it to 1600 px at most and encodes it as WebP (JPEG
 * where the browser cannot encode WebP, notably Safari), at the best quality that keeps it under about 220 KB.
 * A phone photo of several MB becomes a few hundred KB, which keeps the free storage quota safe.
 * @throws `Error("image_unreadable")` when the file is not an image the browser can decode,
 *   `Error("image_too_large")` when it cannot be brought under the budget.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("image_unreadable");
  }

  const canvas = document.createElement("canvas");
  let type: ImageType = "webp";
  const encode: Encoder = (width, height, quality) => {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return Promise.resolve(null);
    // A JPEG has no transparency: paint white first so a transparent PNG does not turn black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          // Safari ignores "image/webp" and answers a PNG: ask again for a JPEG.
          if (blob && blob.type === "image/webp") {
            type = "webp";
            resolve(blob);
          } else {
            canvas.toBlob(
              (jpeg) => {
                type = "jpg";
                resolve(jpeg);
              },
              "image/jpeg",
              quality,
            );
          }
        },
        "image/webp",
        quality,
      );
    });
  };

  try {
    const result = await encodeWithinBudget(
      encode,
      bitmap.width,
      bitmap.height,
      IMAGE_TARGET_BYTES,
    );
    if (!result) throw new Error("image_too_large");
    return { ...result, type };
  } finally {
    bitmap.close();
  }
}
