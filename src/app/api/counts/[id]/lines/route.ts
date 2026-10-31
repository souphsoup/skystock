import { handle, intParam, jsonBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/session";
import { saveLines } from "@/lib/stock";
import { can, type LineInput } from "@/lib/types";

export async function POST(req: Request, ctx: RouteContext<"/api/counts/[id]/lines">) {
  return handle(async () => {
    const user = await requireApiUser(can.count);
    const countId = intParam((await ctx.params).id, "count");
    const body = await jsonBody<{ lines?: LineInput[] }>(req);
    if (!Array.isArray(body.lines) || body.lines.length > 500) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    return saveLines(user, countId, body.lines);
  });
}
