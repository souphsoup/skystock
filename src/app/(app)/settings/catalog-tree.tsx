"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Catalog, CatalogCategory, CatalogItem } from "@/lib/settings";
import { LEVEL_LABEL, categoryPath, itemCount } from "@/lib/catalog-tree";
import { addCategoryAction, deleteCategoryAction, renameCategoryAction } from "@/app/actions/settings";
import { fmtQty } from "@/components/status";
import { IconSearch } from "@/components/icons";

export function CatalogTree({ catalog }: { catalog: Catalog }) {
  const [location, setLocation] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(() => {
    const first = catalog.categories.find((c) => c.parentId === null);
    return new Set(first ? [first.id] : []);
  });

  const items = catalog.items.filter((i) => location === "all" || i.locationId === location);
  const q = query.trim().toLowerCase();
  const locName = new Map(catalog.locations.map((l) => [l.id, l.name]));
  const top = catalog.categories.filter((c) => c.parentId === null);
  const uncategorised = items.filter((i) => i.categoryId === null);

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <p className="mb-3 text-sm text-muted">จัดได้ 3 ชั้น: หมวด › ชนิด › ส่วน · ย้ายรายการข้ามหมวดได้ ประวัติการนับเดิมไม่หาย</p>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="จุดเก็บ">
        {[{ id: "all" as const, name: "ทุกจุด" }, ...catalog.locations].map((l) => {
          const n = l.id === "all" ? catalog.items.length : catalog.items.filter((i) => i.locationId === l.id).length;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={location === l.id}
              onClick={() => setLocation(l.id)}
              className={`pill min-h-10 shrink-0 border px-4 text-sm ${
                location === l.id ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted"
              }`}
            >
              {l.name} <span className="num opacity-80">{n}</span>
            </button>
          );
        })}
      </div>

      <label className="relative mb-4 block">
        <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" width={18} height={18} />
        <input
          className="input pl-10"
          placeholder="ค้นหา ไทย / English"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="ค้นหารายการ"
        />
      </label>

      {q ? (
        <ul className="card divide-y divide-line">
          {items
            .filter((i) => i.nameTh.toLowerCase().includes(q) || i.nameEn.toLowerCase().includes(q))
            .map((i) => (
              <ItemRow
                key={i.id}
                item={i}
                sub={[...categoryPath(catalog.categories, i.categoryId), locName.get(i.locationId)].filter(Boolean).join(" › ")}
              />
            ))}
        </ul>
      ) : (
        <div className="grid gap-3">
          {top.map((c) => (
            <section key={c.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(c.id)}
                aria-expanded={open.has(c.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
              >
                <span>
                  <b className="text-lg">{c.name}</b>
                  <span className="ml-2 text-sm text-muted">หมวด</span>
                </span>
                <span className="text-sm text-muted">
                  {itemCount(catalog.categories, items, c.id)} รายการ <span aria-hidden>{open.has(c.id) ? "▾" : "▸"}</span>
                </span>
              </button>
              {open.has(c.id) && (
                <div className="border-t border-line px-4 pt-2 pb-3">
                  <CategoryBody category={c} catalog={catalog} items={items} />
                </div>
              )}
            </section>
          ))}

          {uncategorised.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="px-4 pt-3 font-semibold text-muted">ยังไม่มีหมวด</h2>
              <ul className="divide-y divide-line">
                {uncategorised.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </ul>
            </section>
          )}

          <AddCategory parent={null} label="+ เพิ่มหมวดใหม่" />
        </div>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-10 mx-auto max-w-xl px-4 pb-3">
        <Link href="/settings/items/new" className="btn btn-primary w-full text-lg shadow-lg">
          + เพิ่มรายการใหม่
        </Link>
      </div>
      <div className="h-20" aria-hidden />
    </>
  );
}

function CategoryBody({ category, catalog, items }: { category: CatalogCategory; catalog: Catalog; items: CatalogItem[] }) {
  const own = items.filter((i) => i.categoryId === category.id);
  const children = catalog.categories.filter((c) => c.parentId === category.id);
  return (
    <>
      <CategoryActions category={category} />
      {own.length > 0 && (
        <ul className="divide-y divide-line">
          {own.map((i) => (
            <ItemRow key={i.id} item={i} />
          ))}
        </ul>
      )}
      {children.map((child) => (
        <div key={child.id} className="mt-2 border-l-2 border-accent/40 pl-3">
          <p className="pt-1">
            <b>{child.name}</b>
            <span className="ml-2 text-sm text-muted">
              {LEVEL_LABEL[child.level]} · {itemCount(catalog.categories, items, child.id)}
            </span>
          </p>
          <CategoryBody category={child} catalog={catalog} items={items} />
        </div>
      ))}
      {category.level < 3 && (
        <AddCategory parent={category} label={`+ เพิ่ม${LEVEL_LABEL[category.level + 1]}ใหม่ใน${category.name}`} />
      )}
    </>
  );
}

function ItemRow({ item, sub }: { item: CatalogItem; sub?: string }) {
  return (
    <li>
      <Link href={`/settings/items/${item.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
        <span className="min-w-0">
          <span className={`block truncate font-medium ${item.active ? "" : "text-muted line-through"}`}>
            {item.nameTh}
            {item.nameEn && <span className="text-muted"> · {item.nameEn}</span>}
          </span>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
          {!item.active && <span className="pill bg-line text-muted">ปิดใช้งาน</span>}
          {item.blind && <span className="pill bg-sky-soft text-sky">Blind</span>}
          <span>{item.unit}</span>
          {item.par > 0 && <span className="num">· Par {fmtQty(item.par)}</span>}
        </span>
      </Link>
    </li>
  );
}

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (fn: () => Promise<{ error: string | null }>, done?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
      if (!r.error) {
        done?.();
        router.refresh();
      }
    });
  return { pending, error, save };
}

function AddCategory({ parent, label }: { parent: CatalogCategory | null; label: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const { pending, error, save } = useSave();
  if (!editing) {
    return (
      <button type="button" className="mt-1 min-h-11 text-left text-sm font-semibold text-accent" onClick={() => setEditing(true)}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => addCategoryAction(parent?.id ?? null, name), () => {
          setName("");
          setEditing(false);
        });
      }}
    >
      <input
        className="input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={parent ? `ชื่อ${LEVEL_LABEL[parent.level + 1]} เช่น Wagyu` : "ชื่อหมวด เช่น เนื้อวัว"}
        aria-label="ชื่อหมวดใหม่"
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setEditing(false)} disabled={pending}>
          ยกเลิก
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
          เพิ่ม
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </form>
  );
}

function CategoryActions({ category }: { category: CatalogCategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const { pending, error, save } = useSave();
  return (
    <div className="mb-1">
      {editing ? (
        <form
          className="grid gap-2 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(() => renameCategoryAction(category.id, name), () => setEditing(false));
          }}
        >
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={`ชื่อ${LEVEL_LABEL[category.level]}`} />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="btn text-bad"
              disabled={pending}
              onClick={() => save(() => deleteCategoryAction(category.id))}
            >
              ลบ
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)} disabled={pending}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
              บันทึก
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-4 text-sm">
          <Link href={`/settings/items/new?category=${category.id}`} className="min-h-10 py-2 font-semibold text-accent">
            + เพิ่มรายการใน{category.name}
          </Link>
          <button type="button" className="min-h-10 py-2 text-muted underline" onClick={() => setEditing(true)}>
            แก้ชื่อ / ลบ
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
