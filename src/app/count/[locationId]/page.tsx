import { notFound } from "next/navigation";
import { HttpError, requireUser } from "@/lib/session";
import { getSheet } from "@/lib/stock";
import { can } from "@/lib/types";
import { IdleGuard } from "@/components/idle-guard";
import { CountScreen } from "./count-screen";

export default async function CountPage({ params }: PageProps<"/count/[locationId]">) {
  const user = await requireUser(can.count);
  const locationId = Number((await params).locationId);
  if (!Number.isInteger(locationId) || locationId <= 0) notFound();
  const sheet = await getSheet(user, locationId).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <IdleGuard />
      <CountScreen initial={sheet} />
    </>
  );
}
