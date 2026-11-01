"use client";

import { createContext, useContext, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Catalog, CatalogCategory, CatalogItem } from "@/lib/settings";
import { LEVEL_LABEL, LEVEL_NAME, categoryPath, itemCount, subtreeItems } from "@/lib/catalog-tree";
import { addCategoryAction, deleteCategoryAction, renameCategoryAction, setItemsActiveAction } from "@/app/actions/settings";
import { fmtQty } from "@/components/status";
import { IconSearch } from "@/components/icons";
import { tk } from "@/i18n";
import { useT } from "@/i18n/client";

/** "+ add a new <level> in <name>" for the level being added (Thai keys) */
const ADD_LABEL: Record<number, string> = {
  2: tk("+ เพิ่มชนิดใหม่ใน{name}"),
  3: tk("+ เพิ่มส่วนใหม่ใน{name}"),
};
/** Placeholder for a new category name at a level (Thai keys) */
const NAME_PLACEHOLDER: Record<number, string> = {
  2: tk("ชื่อชนิด เช่น Wagyu"),
  3: tk("ชื่อส่วน เช่น Wagyu"),
};

/** Multi-select state shared by every row of the tree while "เลือกหลายรายการ" is on. */
interface Selection {
  on: boolean;
  ids: Set<number>;
  set: (ids: number[], checked: boolean) => void;
}
const SelectionContext = createContext<Selection>({ on: false, ids: new Set(), set: () => {} });

export function CatalogTree({ catalog }: { catalog: Catalog }) {
  const { t } = useT();
  const [location, setLocation] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(() => {
    const first = catalog.categories.find((c) => c.parentId === null);
    return new Set(first ? [first.id] : []);
  });

  const [showOff, setShowOff] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const { pending, error, save } = useSave();

  const atLocation = catalog.items.filter((i) => location === "all" || i.locationId === location);
  const offCount = atLocation.filter((i) => !i.active).length;
  // Turned-off items stay out of the way until asked for; search still finds them so they can be turned back on.
  const items = showOff ? atLocation : atLocation.filter((i) => i.active);
  const q = query.trim().toLowerCase();
  const locName = new Map(catalog.locations.map((l) => [l.id, l.name]));
  const top = catalog.categories.filter((c) => c.parentId === null && (showOff || !allOff(catalog, atLocation, c.id)));
  const uncategorised = items.filter((i) => i.categoryId === null);

  const selection: Selection = {
    on: selecting,
    ids: selected,
    set: (ids, checked) =>
      setSelected((s) => {
        const n = new Set(s);
        for (const id of ids) {
          if (checked) n.add(id);
          else n.delete(id);
        }
        return n;
      }),
  };
  const picked = catalog.items.filter((i) => selected.has(i.id));
  const pickedOn = picked.filter((i) => i.active);
  const pickedOff = picked.filter((i) => !i.active);
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const apply = (list: CatalogItem[], active: boolean) =>
    save(
      () => setItemsActiveAction(list.map((i) => i.id), active),
      () => {
        stopSelecting();
        const n = list.length;
        setNotice(active ? t("เปิดใช้งานแล้ว {n} รายการ", { n }) : t("ปิดใช้งานแล้ว {n} รายการ · ไม่อยู่ในใบนับแล้ว", { n }));
      },
    );

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <p className="mb-3 text-sm text-muted">{t("จัดได้ 3 ชั้น: หมวด › ชนิด › ส่วน · ย้ายรายการข้ามหมวดได้ ประวัติการนับเดิมไม่หาย")}</p>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t("จุดเก็บ")}>
        {[{ id: "all" as const, name: t("ทุกจุด") }, ...catalog.locations].map((l) => {
          const n = catalog.items.filter((i) => (l.id === "all" || i.locationId === l.id) && (showOff || i.active)).length;
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
          placeholder={t("ค้นหา ไทย / English")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("ค้นหารายการ")}
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={selecting}
          onClick={() => (selecting ? stopSelecting() : (setSelecting(true), setNotice(null)))}
          className={`pill min-h-10 border px-4 text-sm ${selecting ? "border-accent-line bg-accent-soft text-hl" : "border-line bg-surface text-ink"}`}
        >
          {selecting ? t("✓ กำลังเลือก · {n}", { n: selected.size }) : t("เลือกหลายรายการ")}
        </button>
        {offCount > 0 && (
          <button
            type="button"
            aria-pressed={showOff}
            onClick={() => setShowOff((v) => !v)}
            className={`pill min-h-10 border px-4 text-sm ${showOff ? "border-accent-line bg-accent-soft text-hl" : "border-line bg-surface text-muted"}`}
          >
            {showOff ? t("ซ่อนที่ปิดใช้งาน") : t("แสดงที่ปิดใช้งาน ({n})", { n: offCount })}
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-3 py-2 text-sm font-medium text-ok">
          {notice}
        </p>
      )}

      <SelectionContext value={selection}>

        {q ? (
          <ul className="card divide-y divide-line">
            {atLocation
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
                    <span className="ml-2 text-sm text-muted">{t("หมวด")}</span>
                    {allOff(catalog, atLocation, c.id) && <span className="pill ml-2 bg-line text-muted">{t("ปิดใช้งาน")}</span>}
                  </span>
                  <span className="text-sm text-muted">
                    {t("{n} รายการ", { n: itemCount(catalog.categories, items, c.id) })} <span aria-hidden>{open.has(c.id) ? "▾" : "▸"}</span>
                  </span>
                </button>
                {open.has(c.id) && (
                  <div className="border-t border-line px-4 pt-2 pb-3">
                    <CategoryBody category={c} catalog={catalog} items={items} all={atLocation} />
                  </div>
                )}
              </section>
            ))}

            {uncategorised.length > 0 && (
              <section className="card overflow-hidden">
                <h2 className="px-4 pt-3 font-semibold text-muted">{t("ยังไม่มีหมวด")}</h2>
                <ul className="divide-y divide-line">
                  {uncategorised.map((i) => (
                    <ItemRow key={i.id} item={i} />
                  ))}
                </ul>
              </section>
            )}

            {!selecting && <AddCategory parent={null} label={t("+ เพิ่มหมวดใหม่")} />}
          </div>
        )}
      </SelectionContext>

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-10 mx-auto max-w-xl px-4 pb-3">
        {selecting ? (
          <div className="card grid gap-2 p-3 shadow-lg">
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={stopSelecting} disabled={pending}>
                {t("ยกเลิก")}
              </button>
              {pickedOff.length > 0 && (
                <button type="button" className="btn flex-1" onClick={() => apply(pickedOff, true)} disabled={pending}>
                  {t("เปิดใช้ {n}", { n: pickedOff.length })}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => apply(pickedOn, false)}
                disabled={pending || pickedOn.length === 0}
              >
                {pickedOn.length > 0 ? t("ปิดใช้งาน {n} รายการ", { n: pickedOn.length }) : t("แตะรายการที่จะปิด")}
              </button>
            </div>
          </div>
        ) : (
          <Link href="/settings/items/new" className="btn btn-primary w-full text-lg shadow-lg">
            {t("+ เพิ่มรายการใหม่")}
          </Link>
        )}
      </div>
      <div className={selecting ? "h-28" : "h-20"} aria-hidden />
    </>
  );
}

/** A category that has items here, all of them turned off. */
function allOff(catalog: Catalog, items: CatalogItem[], id: number) {
  const list = subtreeItems(catalog.categories, items, id);
  return list.length > 0 && list.every((i) => !i.active);
}

function CategoryBody({
  category,
  catalog,
  items,
  all,
}: {
  category: CatalogCategory;
  catalog: Catalog;
  items: CatalogItem[];
  all: CatalogItem[];
}) {
  const { t } = useT();
  const selection = useContext(SelectionContext);
  const own = items.filter((i) => i.categoryId === category.id);
  // a sub-level whose items are all turned off disappears with them
  const children = catalog.categories.filter(
    (c) => c.parentId === category.id && !(allOff(catalog, all, c.id) && itemCount(catalog.categories, items, c.id) === 0),
  );
  return (
    <>
      {selection.on ? (
        <SelectAll category={category} items={subtreeItems(catalog.categories, items, category.id)} />
      ) : (
        <CategoryActions category={category} items={subtreeItems(catalog.categories, all, category.id)} />
      )}
      {own.length > 0 && (
        <ul className="divide-y divide-line">
          {own.map((i) => (
            <ItemRow key={i.id} item={i} />
          ))}
        </ul>
      )}
      {children.map((child) => (
        <div key={child.id} className="mt-2 border-l-2 border-accent-line pl-3">
          <p className="pt-1">
            <b>{child.name}</b>
            <span className="ml-2 text-sm text-muted">
              {t(LEVEL_LABEL[child.level])} · {itemCount(catalog.categories, items, child.id)}
            </span>
            {allOff(catalog, all, child.id) && <span className="pill ml-2 bg-line text-muted">{t("ปิดใช้งาน")}</span>}
          </p>
          <CategoryBody category={child} catalog={catalog} items={items} all={all} />
        </div>
      ))}
      {category.level < 3 && !selection.on && (
        <AddCategory parent={category} label={t(ADD_LABEL[category.level + 1], { name: category.name })} />
      )}
    </>
  );
}

function SelectAll({ category, items }: { category: CatalogCategory; items: CatalogItem[] }) {
  const { t } = useT();
  const selection = useContext(SelectionContext);
  if (items.length === 0) return null;
  const every = items.every((i) => selection.ids.has(i.id));
  return (
    <button
      type="button"
      className="min-h-10 py-2 text-left text-sm font-semibold text-hl"
      onClick={() => selection.set(items.map((i) => i.id), !every)}
    >
      {every ? t("เอาออกทั้ง{name}", { name: category.name }) : t("เลือกทั้ง{name} ({n})", { name: category.name, n: items.length })}
    </button>
  );
}

function ItemRow({ item, sub }: { item: CatalogItem; sub?: string }) {
  const { t } = useT();
  const selection = useContext(SelectionContext);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${item.active ? "" : "text-muted line-through"}`}>
          {item.nameTh}
          {item.nameEn && <span className="text-muted"> · {item.nameEn}</span>}
        </span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
        {!item.active && <span className="pill bg-line text-muted">{t("ปิดใช้งาน")}</span>}
        {item.blind && <span className="pill bg-sky-soft text-sky">Blind</span>}
        <span>{item.unit}</span>
        {item.par > 0 && <span className="num">· Par {fmtQty(item.par)}</span>}
      </span>
    </>
  );
  if (selection.on) {
    return (
      <li>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-[var(--accent)]"
            checked={selection.ids.has(item.id)}
            onChange={(e) => selection.set([item.id], e.target.checked)}
          />
          {body}
        </label>
      </li>
    );
  }
  return (
    <li>
      <Link href={`/settings/items/${item.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
        {body}
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
  const { t } = useT();
  if (!editing) {
    return (
      <button type="button" className="mt-1 min-h-11 text-left text-sm font-semibold text-hl" onClick={() => setEditing(true)}>
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
        placeholder={parent ? t(NAME_PLACEHOLDER[parent.level + 1]) : t("ชื่อหมวด เช่น เนื้อวัว")}
        aria-label={t("ชื่อหมวดใหม่")}
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setEditing(false)} disabled={pending}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
          {t("เพิ่ม")}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </form>
  );
}

function CategoryActions({ category, items }: { category: CatalogCategory; items: CatalogItem[] }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(category.name);
  const { pending, error, save } = useSave();
  const { t } = useT();
  const on = items.filter((i) => i.active);
  const off = items.filter((i) => !i.active);
  const close = () => {
    setEditing(false);
    setConfirming(false);
  };
  return (
    <div className="mb-1">
      {editing ? (
        <form
          className="grid gap-2 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(() => renameCategoryAction(category.id, name), close);
          }}
        >
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={t(LEVEL_NAME[category.level])} />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="btn text-bad"
              disabled={pending}
              onClick={() => save(() => deleteCategoryAction(category.id))}
            >
              {t("ลบ")}
            </button>
            <button type="button" className="btn" onClick={close} disabled={pending}>
              {t("ยกเลิก")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
              {t("บันทึก")}
            </button>
          </div>
          {on.length > 0 ? (
            <button
              type="button"
              className={`btn w-full ${confirming ? "border-bad bg-bad-soft text-bad" : ""}`}
              disabled={pending}
              onClick={() =>
                confirming ? save(() => setItemsActiveAction(on.map((i) => i.id), false), close) : setConfirming(true)
              }
            >
              {confirming
                ? t("แตะอีกครั้งเพื่อปิด {n} รายการ", { n: on.length })
                : t("ปิดใช้งานทั้ง{name} ({n} รายการ)", { name: category.name, n: on.length })}
            </button>
          ) : (
            off.length > 0 && (
              <button
                type="button"
                className="btn w-full"
                disabled={pending}
                onClick={() => save(() => setItemsActiveAction(off.map((i) => i.id), true), close)}
              >
                {t("เปิดใช้งานทั้ง{name} ({n} รายการ)", { name: category.name, n: off.length })}
              </button>
            )
          )}
          {items.length > 0 && (
            <p className="text-sm text-muted">{t("ปิดแล้วรายการจะไม่อยู่ในใบนับ แต่ประวัติการนับและรายงานเดิมยังอยู่ครบ")}</p>
          )}
        </form>
      ) : (
        <div className="flex gap-4 text-sm">
          <Link href={`/settings/items/new?category=${category.id}`} className="min-h-10 py-2 font-semibold text-hl">
            {t("+ เพิ่มรายการใน{name}", { name: category.name })}
          </Link>
          <button type="button" className="min-h-10 py-2 text-muted underline" onClick={() => setEditing(true)}>
            {t("แก้ไข / ปิด / ลบ")}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
