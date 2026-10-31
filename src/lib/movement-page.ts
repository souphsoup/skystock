import "server-only";
import { getCatalog } from "./settings";
import { categoryPath } from "./catalog-tree";
import type { User } from "./session";

export interface PickItem {
  id: number;
  locationId: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  path: string;
}

/** Locations and active items for the รับของ / เบิก-โอน / ของเสีย forms. */
export async function movementPageData(user: User) {
  const catalog = await getCatalog(user);
  const items: PickItem[] = catalog.items
    .filter((i) => i.active)
    .map((i) => ({
      id: i.id,
      locationId: i.locationId,
      nameTh: i.nameTh,
      nameEn: i.nameEn,
      unit: i.unit,
      path: categoryPath(catalog.categories, i.categoryId).join(" › "),
    }));
  return { locations: catalog.locations.map(({ id, name }) => ({ id, name })), items };
}
