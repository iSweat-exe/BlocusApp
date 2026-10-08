import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeWithinBudget, type Encoder } from "./compress-image";
import { announcementImageUrl, detectImageType, fitWithin } from "./image";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe("detectImageType", () => {
  it("recognizes WebP and JPEG from their first bytes", () => {
    const webp = bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), 0);
    expect(detectImageType(webp)).toBe("webp");
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe("jpg");
  });

  it("refuses everything else, whatever the file is called", () => {
    expect(detectImageType(bytes(0x89, ...ascii("PNG"), 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(detectImageType(bytes(...ascii("GIF89a"), 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});

describe("fitWithin", () => {
  it("scales the longest side down to the maximum, keeping the ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never scales up and never reaches zero", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe("announcementImageUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("points at the public bucket of the Supabase project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    expect(announcementImageUrl("u/i.webp")).toBe(
      "https://x.supabase.co/storage/v1/object/public/announcement-images/u/i.webp",
    );
  });
});

describe("encodeWithinBudget", () => {
  // A fake encoder whose output grows with the surface and the quality.
  const fake =
    (calls: [number, number, number][] = []): Encoder =>
    async (width, height, quality) => {
      calls.push([width, height, quality]);
      return new Blob([new Uint8Array(Math.round(width * height * quality * 0.3))]);
    };

  it("keeps the best quality when it already fits", async () => {
    const calls: [number, number, number][] = [];
    const result = await encodeWithinBudget(fake(calls), 800, 600, 1_000_000);
    expect(result).toMatchObject({ width: 800, height: 600 });
    expect(calls).toEqual([[800, 600, 0.8]]);
  });

  it("lowers the quality, then the size, until it fits", async () => {
    const result = await encodeWithinBudget(fake(), 4000, 3000, 220 * 1024);
    expect(result).not.toBeNull();
    expect(result!.blob.size).toBeLessThanOrEqual(220 * 1024);
    // Started from 1600 px and had to shrink.
    expect(Math.max(result!.width, result!.height)).toBeLessThan(1600);
  });

  it("gives up with null when even the smallest version is too big, or the browser cannot encode", async () => {
    expect(await encodeWithinBudget(fake(), 4000, 3000, 10)).toBeNull();
    expect(await encodeWithinBudget(async () => null, 800, 600, 1000)).toBeNull();
  });
});
