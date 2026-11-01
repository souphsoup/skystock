"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { changeOwnPin, updateOwnName } from "@/lib/me";
import { errorMessage } from "@/i18n/server";

export type ActionResult = { error: string | null };

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e) };
  }
}

// Any signed-in role, always on their own account.
export async function updateOwnNameAction(name: string) {
  return run(async () => updateOwnName(await requireApiUser(), name));
}
export async function changeOwnPinAction(currentPin: string, pin: string) {
  return run(async () => changeOwnPin(await requireApiUser(), currentPin, pin));
}
