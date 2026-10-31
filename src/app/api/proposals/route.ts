import { handle, jsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { proposeItem } from "@/lib/proposals";
import type { ProposalInput } from "@/lib/proposal-types";
import { can } from "@/lib/types";

// Staff propose an item missing from the count sheet (sent from the offline queue).
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser(can.count);
    return proposeItem(user, await jsonBody<ProposalInput>(req));
  });
}
