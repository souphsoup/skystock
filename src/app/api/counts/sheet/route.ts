import { handle, intParam } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { getSheet } from "@/lib/stock";
import { can } from "@/lib/types";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser(can.count);
    const locationId = intParam(new URL(req.url).searchParams.get("location"), "location");
    return { sheet: await getSheet(user, locationId) };
  });
}
