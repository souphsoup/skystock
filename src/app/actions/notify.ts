"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser, type User } from "@/lib/session";
import * as notify from "@/lib/notify";
import { can } from "@/lib/types";

export type NotifyResult = { error: string | null; status?: string; results?: notify.SendResult[] };

async function run(fn: (u: User) => Promise<NotifyResult | void>): Promise<NotifyResult> {
  try {
    const user = await requireApiUser(can.users);
    const out = await fn(user);
    revalidatePath("/settings/notify");
    return out ?? { error: null };
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error(e);
    return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

export async function addTargetAction(channel: notify.Channel, address: string, label: string) {
  return run(async (u) => {
    if (channel !== "line" && channel !== "email") throw new HttpError(400, "ช่องทางไม่ถูกต้อง");
    await notify.addTarget(u, channel, address, label);
  });
}
export async function setTargetActiveAction(id: number, active: boolean) {
  return run((u) => notify.setTargetActive(u, id, active));
}
export async function removeTargetAction(id: number) {
  return run((u) => notify.removeTarget(u, id));
}
/** targetId: test one recipient (even if switched off); omitted: everyone switched on */
export async function sendTestAction(targetId?: number) {
  return run(async (u) => {
    if (targetId !== undefined && !(Number.isInteger(targetId) && targetId > 0)) throw new HttpError(400, "ผู้รับไม่ถูกต้อง");
    const r = await notify.sendDigest(u.outletId, { kind: "test", targetId, userId: u.id });
    if (r.status === "no_targets") throw new HttpError(400, "ยังไม่มีผู้รับที่เปิดไว้");
    return { error: null, status: r.status, results: r.results };
  });
}
