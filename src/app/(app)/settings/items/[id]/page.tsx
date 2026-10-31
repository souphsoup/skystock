import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getCatalog } from "@/lib/settings";
import { can } from "@/lib/types";
import { ItemForm } from "../item-form";

export default async function EditItemPage({ params }: PageProps<"/settings/items/[id]">) {
  const user = await requireUser(can.settings);
  const catalog = await getCatalog(user);
  const id = Number((await params).id);
  const item = catalog.items.find((i) => i.id === id);
  if (!item) notFound();
  return <ItemForm catalog={catalog} item={item} defaultCategoryId={item.categoryId} />;
}
