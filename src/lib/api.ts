import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./session";
import { errorMessage } from "@/i18n/server";

/** Wrap a route handler: HttpError → JSON error with its status; anything else → 500. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : NextResponse.json(out);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: await errorMessage(e) }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: await errorMessage(e, "เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้ง") }, { status: 500 });
  }
}

/** Only accept JSON bodies: a cross-site form cannot send application/json without a CORS preflight. */
export async function jsonBody<T>(req: Request): Promise<T> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "ต้องส่งข้อมูลเป็น JSON");
  }
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
  }
}

export function intParam(v: string | null | undefined, name: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "{name} ไม่ถูกต้อง", { name });
  return n;
}
