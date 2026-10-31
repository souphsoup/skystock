import { requireUser } from "@/lib/session";
import { getCatalog } from "@/lib/settings";
import { can } from "@/lib/types";
import { ItemForm } from "../item-form";

export default async function NewItemPage({ searchParams }: PageProps<"/settings/items/new">) {
  const user = await requireUser(can.settings);
  const catalog = await getCatalog(user);
  const c = Number((await searchParams).category);
  const categoryId = catalog.categories.some((x) => x.id === c) ? c : null;
  return <ItemForm catalog={catalog} item={null} defaultCategoryId={categoryId} />;
}
