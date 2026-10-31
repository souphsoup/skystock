import { handle, intParam, jsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { submitCount } from "@/lib/stock";
import { can } from "@/lib/types";

export async function POST(req: Request, ctx: RouteContext<"/api/counts/[id]/submit">) {
  return handle(async () => {
    const user = await requireApiUser(can.count);
    await jsonBody(req);
    const countId = intParam((await ctx.params).id, "count");
    return { sheet: await submitCount(user, countId) };
  });
}
