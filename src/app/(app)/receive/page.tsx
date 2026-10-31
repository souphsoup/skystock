import { requireUser } from "@/lib/session";
import { movementPageData } from "@/lib/movement-page";
import { can } from "@/lib/types";
import { MovementForm } from "@/components/movement-form";

export default async function ReceivePage() {
  const user = await requireUser(can.count);
  const { locations, items } = await movementPageData(user);
  return <MovementForm kinds={["receive"]} locations={locations} items={items} />;
}
