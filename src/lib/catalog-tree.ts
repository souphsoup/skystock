// Client-safe helpers for the หมวด › ชนิด › ส่วน tree.
import type { CatalogCategory, CatalogItem } from "./settings";

export const LEVEL_LABEL = ["", "หมวด", "ชนิด", "ส่วน"];

export function categoryPath(categories: CatalogCategory[], id: number | null): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: string[] = [];
  for (let c = id ? byId.get(id) : undefined; c; c = c.parentId ? byId.get(c.parentId) : undefined) path.unshift(c.name);
  return path;
}

/** Categories in tree order (parent before children), for <select> lists. */
export function flattenTree(categories: CatalogCategory[]): CatalogCategory[] {
  const out: CatalogCategory[] = [];
  const walk = (parentId: number | null) => {
    for (const c of categories.filter((x) => x.parentId === parentId)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(null);
  return out;
}

/** Number of items in a category including all of its descendants. */
export function itemCount(categories: CatalogCategory[], items: CatalogItem[], id: number): number {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId !== null && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return items.filter((i) => i.categoryId !== null && ids.has(i.categoryId)).length;
}
