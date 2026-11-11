// Browser-only: shrinks a phone photo before it is sent to the server. A 12 MP camera shot is
// 3–6 MB; at 1600px JPEG it is a few hundred KB, well under the server action body limit, and
// still sharp enough to read meter digits.

import { METER_PHOTO_MAX_DIMENSION } from "@/lib/meterOcr";

const JPEG_QUALITY = 0.85;

/**
 * Returns a JPEG no larger than METER_PHOTO_MAX_DIMENSION on its longest side, honouring EXIF
 * orientation. Falls back to the original file when the browser cannot decode it (e.g. HEIC on
 * desktop Chrome); the server then validates its type and size.
 */
export async function prepareMeterPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, METER_PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    return new File([blob], "meter.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
