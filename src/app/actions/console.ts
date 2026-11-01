"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { saveCostPar, type CostChange } from "@/lib/insights";
import { can } from "@/lib/types";
import { errorMessage } from "@/i18n/server";

export async function saveCostParAction(changes: CostChange[]): Promise<{ error: string | null; saved?: number }> {
  try {
    const user = await requireApiUser(can.settings);
    const saved = await saveCostPar(user, changes);
    revalidatePath("/", "layout");
    return { error: null, saved };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e) };
  }
}
