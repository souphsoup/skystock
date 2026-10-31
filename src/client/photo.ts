"use client";

/** Shrink a camera photo to ≤1600px JPEG (~200–400 KB) before it is queued and uploaded. */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.75): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file; // unsupported format: send as-is (server checks type and size)
  }
}
