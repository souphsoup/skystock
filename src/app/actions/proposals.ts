"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { approveProposal, rejectProposal, type CountedResult } from "@/lib/proposals";
import type { ItemInput } from "@/lib/settings";
import { errorMessage } from "@/i18n/server";
import { can } from "@/lib/types";

export async function approveProposalAction(
  id: number,
  input: ItemInput,
): Promise<{ error: string | null; counted?: CountedResult }> {
  try {
    const user = await requireApiUser(can.review);
    const r = await approveProposal(user, id, input);
    revalidatePath("/", "layout");
    return { error: null, counted: r.counted };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e) };
  }
}

export async function rejectProposalAction(id: number, reason: string): Promise<{ error: string | null }> {
  try {
    const user = await requireApiUser(can.review);
    await rejectProposal(user, id, reason);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e) };
  }
}
