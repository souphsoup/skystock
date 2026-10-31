import "server-only";
import { HttpError } from "./session";

// Photo storage for delivery notes and waste. Production: Supabase Storage
// (private bucket, accessed only with the service role key from this server).
// Local development: .data/uploads.

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key, bucket: process.env.STORAGE_BUCKET ?? "sop-stock" };
}

const localDir = () => `${process.cwd()}/.data/uploads`;

function checkKey(key: string) {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes("..")) throw new HttpError(400, "ชื่อไฟล์ไม่ถูกต้อง");
}

export async function putPhoto(key: string, file: File): Promise<void> {
  checkKey(key);
  if (!ALLOWED.has(file.type)) throw new HttpError(415, "รองรับเฉพาะรูป JPG, PNG หรือ WebP");
  if (file.size > MAX_PHOTO_BYTES) throw new HttpError(413, "รูปใหญ่เกิน 5 MB");
  const bytes = Buffer.from(await file.arrayBuffer());

  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${key}`, {
      method: "POST",
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "Content-Type": file.type, "x-upsert": "true" },
      body: bytes,
    });
    if (!res.ok) {
      console.error("storage upload failed", res.status, await res.text().catch(() => ""));
      throw new HttpError(502, "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    throw new HttpError(503, "ยังไม่ได้ตั้งค่าที่เก็บรูป (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const path = `${localDir()}/${key}`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function getPhoto(key: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  checkKey(key);
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/authenticated/${sb.bucket}/${key}`, {
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
    });
    if (!res.ok) return null;
    return { bytes: await res.arrayBuffer(), type: res.headers.get("content-type") ?? type };
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const buf = await readFile(`${localDir()}/${key}`);
    return { bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, type };
  } catch {
    return null;
  }
}
