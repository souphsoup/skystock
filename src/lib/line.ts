import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// LINE Messaging API (LINE Notify ปิดบริการไปแล้วตั้งแต่ปี 2025)
// https://developers.line.biz/en/reference/messaging-api/

const apiBase = () => process.env.LINE_API_BASE || "https://api.line.me";
const token = () => process.env.LINE_CHANNEL_ACCESS_TOKEN;

export const lineConfigured = () => !!token();
export const lineWebhookConfigured = () => !!process.env.LINE_CHANNEL_SECRET;

/** userId (U…), groupId (C…) or roomId (R…) */
export const LINE_ID = /^[UCR][0-9a-f]{32}$/;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body) as { message?: string };
    return `LINE ${res.status}: ${j.message ?? body}`;
  } catch {
    return `LINE ${res.status}: ${body.slice(0, 200)}`;
  }
}

export async function pushLine(to: string, messages: unknown[]): Promise<void> {
  // The retry key makes a resend after a timeout deliver once.
  const res = await call("/v2/bot/message/push", {
    method: "POST",
    headers: { "X-Line-Retry-Key": randomUUID() },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) throw new Error(await errorText(res));
}

export async function replyLine(replyToken: string, messages: unknown[]): Promise<void> {
  const res = await call("/v2/bot/message/reply", { method: "POST", body: JSON.stringify({ replyToken, messages }) });
  if (!res.ok) throw new Error(await errorText(res));
}

export interface LineSource {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export const sourceId = (s: LineSource) => s.groupId ?? s.roomId ?? s.userId ?? null;

/** Group name or user's display name, for the settings list. Best effort. */
export async function sourceName(s: LineSource): Promise<string> {
  try {
    if (s.type === "group" && s.groupId) {
      const res = await call(`/v2/bot/group/${s.groupId}/summary`);
      if (res.ok) return ((await res.json()) as { groupName: string }).groupName;
    } else if (s.type === "user" && s.userId) {
      const res = await call(`/v2/bot/profile/${s.userId}`);
      if (res.ok) return ((await res.json()) as { displayName: string }).displayName;
    }
  } catch {
    // name is cosmetic
  }
  return s.type === "group" ? "กลุ่ม LINE" : s.type === "room" ? "ห้องแชท LINE" : "ผู้ใช้ LINE";
}

export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
