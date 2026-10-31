"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Catalog, CatalogItem } from "@/lib/settings";
import { LEVEL_LABEL, categoryPath, flattenTree } from "@/lib/catalog-tree";
import { saveItemAction } from "@/app/actions/settings";
import { Stepper } from "@/components/stepper";
import { IconBack } from "@/components/icons";

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`pill min-h-11 border px-4 text-[15px] ${
            value === o.value ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ItemForm({
  catalog,
  item,
  defaultCategoryId,
}: {
  catalog: Catalog;
  item: CatalogItem | null;
  defaultCategoryId: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId);
  const [nameTh, setNameTh] = useState(item?.nameTh ?? "");
  const [nameEn, setNameEn] = useState(item?.nameEn ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [customUnit, setCustomUnit] = useState(false);
  const [locationId, setLocationId] = useState<number>(item?.locationId ?? catalog.locations[0]?.id ?? 0);
  const [par, setPar] = useState(item?.par ?? 0);
  const [cost, setCost] = useState(item ? String(item.unitCost) : "");
  const [blind, setBlind] = useState(item?.blind ?? false);
  const [active, setActive] = useState(item?.active ?? true);

  const path = categoryPath(catalog.categories, categoryId);
  const tree = flattenTree(catalog.categories);
  const costNum = cost.trim() === "" ? 0 : Number(cost);
  const valid = nameTh.trim() && unit.trim() && locationId && Number.isFinite(costNum) && costNum >= 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveItemAction(item?.id ?? null, {
        categoryId,
        locationId,
        nameTh,
        nameEn,
        unit,
        unitCost: costNum,
        par,
        blind,
        active,
      });
      setError(r.error);
      if (!r.error) {
        router.push("/settings");
        router.refresh();
      }
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-4">
      <Link href="/settings" className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
        <IconBack width={18} height={18} /> ประเภทวัตถุดิบ
      </Link>
      <form onSubmit={submit} className="grid gap-5">
        <header>
          <h1 className="text-2xl font-bold">{item ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}</h1>
          <p className="text-muted">อยู่ใน {path.length ? path.join(" › ") : "ยังไม่มีหมวด"}</p>
        </header>

        <label className="grid gap-1.5">
          <span className="font-semibold">หมวด › ชนิด › ส่วน</span>
          <select
            className="input"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— ไม่มีหมวด —</option>
            {tree.map((c) => (
              <option key={c.id} value={c.id}>
                {"   ".repeat(c.level - 1)}
                {c.name} ({LEVEL_LABEL[c.level]})
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="font-semibold">ชื่อไทย</span>
            <input className="input" value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="เช่น สันใน" required />
          </label>
          <label className="grid gap-1.5">
            <span className="font-semibold">
              ชื่ออังกฤษ <span className="font-normal text-muted">(ไม่บังคับ)</span>
            </span>
            <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Tenderloin" />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 font-semibold">หน่วยนับ</legend>
          <Chips
            label="หน่วยนับ"
            value={customUnit ? "__custom" : unit}
            onChange={(v) => {
              if (v === "__custom") {
                setCustomUnit(true);
                setUnit("");
              } else {
                setCustomUnit(false);
                setUnit(v);
              }
            }}
            options={[...catalog.units.map((u) => ({ value: u, label: u })), { value: "__custom", label: "อื่นๆ…" }]}
          />
          {customUnit && (
            <input
              className="input"
              autoFocus
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="พิมพ์หน่วย เช่น กล่อง"
              aria-label="หน่วยนับอื่น"
            />
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">เก็บที่</legend>
          <Chips
            label="จุดเก็บ"
            value={locationId}
            onChange={setLocationId}
            options={catalog.locations.map((l) => ({ value: l.id, label: l.name }))}
          />
          {item && locationId !== item.locationId && (
            <p className="mt-2 text-sm text-warn">ย้ายจุดเก็บ: รายการนี้จะไปอยู่ท้ายใบนับของจุดใหม่ตั้งแต่รอบนับที่ยังไม่ส่ง</p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="font-semibold">ขั้นต่ำ (Par)</span>
            <span className="text-sm text-muted">ต่ำกว่านี้แจ้งเตือน</span>
            <Stepper label="ขั้นต่ำ (Par)" value={par} onChange={setPar} />
          </div>
          <label className="grid content-start gap-1.5">
            <span className="font-semibold">ราคาทุนต่อหน่วย (฿)</span>
            <span className="text-sm text-muted">ใช้คิดมูลค่าคงคลังและส่วนต่าง</span>
            <input
              className="input num"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        <label className="card flex items-start gap-3 p-4">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          <span>
            <b className="block">Blind count</b>
            <span className="text-sm text-muted">ซ่อนยอดที่ระบบคิดไว้ ให้พนักงานนับของจริงทุกครั้ง เหมาะกับของราคาสูง</span>
          </span>
        </label>

        {item && (
          <label className="card flex items-start gap-3 p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <b className="block">ใช้งานอยู่</b>
              <span className="text-sm text-muted">ปิดแล้วรายการจะไม่อยู่ในใบนับ แต่ประวัติการนับและรายงานเดิมยังอยู่ครบ</span>
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
            {error}
          </p>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-2 pb-4">
          <Link href="/settings" className="btn">
            ยกเลิก
          </Link>
          <button type="submit" className="btn btn-primary text-lg" disabled={pending || !valid}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </main>
  );
}
