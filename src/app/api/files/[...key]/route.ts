import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/session";
import { getPhoto } from "@/lib/files";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const key = (await ctx.params).key.join("/");
    if (!key.startsWith(`outlet-${user.outletId}/`)) throw new HttpError(404, "ไม่พบไฟล์");
    const file = await getPhoto(key);
    if (!file) throw new HttpError(404, "ไม่พบไฟล์");
    return new Response(file.bytes, {
      headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=86400" },
    });
  });
}
