import { handle, intParam, jsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { addComment, canComment } from "@/lib/comments";
import type { CommentInput } from "@/lib/comment-types";

// A message in a count round, sent from the count screen's offline queue.
export async function POST(req: Request, ctx: RouteContext<"/api/counts/[id]/comments">) {
  return handle(async () => {
    const user = await requireApiUser(canComment);
    const countId = intParam((await ctx.params).id, "count");
    return { comments: await addComment(user, countId, await jsonBody<CommentInput>(req)) };
  });
}
