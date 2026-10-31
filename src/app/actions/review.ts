"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { adjustLine, approveMatched, confirmLine, requestRecount } from "@/lib/stock";
import { can } from "@/lib/types";

type Result = { error: string | null };

async function run(countId: number, fn: (u: Awaited<ReturnType<typeof requireApiUser>>) => Promise<void>): Promise<Result> {
  try {
    const user = await requireApiUser(can.review);
    await fn(user);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error(e);
    return { error: `ทำรายการไม่สำเร็จ (รอบนับ ${countId})` };
  }
}

export async function confirmLineAction(countId: number, itemId: number) {
  return run(countId, (u) => confirmLine(u, countId, itemId));
}

export async function recountLineAction(countId: number, itemId: number) {
  return run(countId, (u) => requestRecount(u, countId, itemId));
}

export async function adjustLineAction(countId: number, itemId: number, counted: number, reason: string) {
  return run(countId, (u) => adjustLine(u, countId, itemId, counted, reason));
}

export async function approveMatchedAction(countId: number) {
  return run(countId, (u) => approveMatched(u, countId));
}
