"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { tk } from "@/i18n";
import { errorMessage } from "@/i18n/server";
import { voidMovement } from "@/lib/movements";

export async function voidMovementAction(id: number, reason: string): Promise<{ error: string | null }> {
  try {
    const user = await requireApiUser();
    await voidMovement(user, id, reason);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e, tk("ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง")) };
  }
}
