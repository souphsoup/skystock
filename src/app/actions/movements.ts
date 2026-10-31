"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { voidMovement } from "@/lib/movements";

export async function voidMovementAction(id: number, reason: string): Promise<{ error: string | null }> {
  try {
    const user = await requireApiUser();
    await voidMovement(user, id, reason);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error(e);
    return { error: "ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
