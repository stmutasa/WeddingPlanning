/**
 * Client-side receipt downscale (PROMPTS.md §2): longest edge 1600px, JPEG,
 * EXIF orientation baked in. `createImageBitmap(blob, { imageOrientation:
 * "from-image" })` applies the EXIF rotation before we draw, so the bytes we
 * upload are already the right way up; browsers without that option fall
 * back to an <img>, which applies orientation itself in every current
 * engine. The original file is never uploaded, so a 12MP phone photo does
 * not have to cross the wire.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

async function toBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari < 16.4 and friends: fall through to the <img> path.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image could not be read"));
      img.src = url;
    });
  } finally {
    // The element keeps its own decoded copy; revoking here is safe once
    // the load settled, and prevents a leak when it did not.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export interface DownscaledImage {
  blob: Blob;
  /** Object URL for the preview thumbnail; revoke it when done. */
  previewUrl: string;
  width: number;
  height: number;
}

export async function downscaleImage(file: Blob): Promise<DownscaledImage> {
  const source = await toBitmap(file);
  const sourceWidth = "width" in source ? source.width : 0;
  const sourceHeight = "height" in source ? source.height : 0;
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight || 1));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize the photo");
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("This browser cannot resize the photo");

  return { blob, previewUrl: URL.createObjectURL(blob), width, height };
}

/** PDFs go up as they are; only images are downscaled. */
export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
