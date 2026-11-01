"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { addComment, canComment } from "@/lib/comments";
import type { CommentInput } from "@/lib/comment-types";
import { errorMessage } from "@/i18n/server";
import { tk } from "@/i18n";

/** Supervisor replies from the review page (online only, like the other review actions). */
export async function addCommentAction(countId: number, input: CommentInput): Promise<{ error: string | null }> {
  try {
    const user = await requireApiUser(canComment);
    await addComment(user, countId, input);
    revalidatePath(`/review/${countId}`);
    return { error: null };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e, tk("ส่งข้อความไม่สำเร็จ ลองใหม่อีกครั้ง")) };
  }
}
