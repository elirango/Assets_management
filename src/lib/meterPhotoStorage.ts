// Server-only: keeps meter photos as evidence on Vercel Blob. Optional — without
// BLOB_READ_WRITE_TOKEN the photo is still used for recognition but not stored.

import { put } from "@vercel/blob";
import { type MeterType } from "@/lib/constants";

export function isMeterPhotoStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Uploads the photo and returns its URL. Public access with a random suffix: the URL is
 * unguessable and can be sent to the tenant in the WhatsApp payment message.
 */
export async function storeMeterPhoto(tenantId: string, type: MeterType, date: Date, photo: File): Promise<string> {
  const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const day = date.toISOString().slice(0, 10);
  const blob = await put(`meters/${tenantId}/${type.toLowerCase()}-${day}.${extension}`, photo, {
    access: "public",
    addRandomSuffix: true,
    contentType: photo.type,
  });
  return blob.url;
}
