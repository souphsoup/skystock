"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Catalog, CatalogItem } from "@/lib/settings";
import { LEVEL_LABEL, categoryPath, flattenTree } from "@/lib/catalog-tree";
import { saveItemAction } from "@/app/actions/settings";
import { approveProposalAction } from "@/app/actions/proposals";
import { Stepper } from "@/components/stepper";
import { IconBack } from "@/components/icons";
import { useT } from "@/i18n/client";

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

/** Approving a staff proposal: the same form, prefilled, creating the item through the proposal. */
export interface ApproveMode {
  proposalId: number;
  initial: Pick<CatalogItem, "nameTh" | "nameEn" | "unit" | "locationId">;
  intro: React.ReactNode;
  footer: React.ReactNode;
}

export function ItemForm({
  catalog,
  item,
  defaultCategoryId,
  approve,
}: {
  catalog: Catalog;
  item: CatalogItem | null;
  defaultCategoryId: number | null;
  approve?: ApproveMode;
}) {
  const router = useRouter();
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId);
  const init = item ?? approve?.initial;
  const back = approve ? "/review" : "/settings";
  const [nameTh, setNameTh] = useState(init?.nameTh ?? "");
  const [nameEn, setNameEn] = useState(init?.nameEn ?? "");
  const [unit, setUnit] = useState(init?.unit ?? "");
  const [customUnit, setCustomUnit] = useState(false);
  const [locationId, setLocationId] = useState<number>(init?.locationId ?? catalog.locations[0]?.id ?? 0);
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
    const input = { categoryId, locationId, nameTh, nameEn, unit, unitCost: costNum, par, blind, active };
    start(async () => {
      if (approve) {
        const r = await approveProposalAction(approve.proposalId, input);
        setError(r.error);
        if (!r.error) {
          router.push(`/review?added=${encodeURIComponent(nameEn.trim() || nameTh.trim())}&counted=${r.counted}`);
          router.refresh();
        }
        return;
      }
      const r = await saveItemAction(item?.id ?? null, input);
      setError(r.error);
      if (!r.error) {
        router.push("/settings");
        router.refresh();
      }
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-4">
      <Link href={back} className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
        <IconBack width={18} height={18} /> {approve ? t("ตรวจและอนุมัติยอด") : t("ประเภทวัตถุดิบ")}
      </Link>
      <form onSubmit={submit} className="grid gap-5">
        <header>
          <h1 className="text-2xl font-bold">
            {approve ? t("อนุมัติรายการที่เสนอ") : item ? t("แก้ไขรายการ") : t("เพิ่มรายการใหม่")}
          </h1>
          <p className="text-muted">{t("อยู่ใน {path}", { path: path.length ? path.join(" › ") : t("ยังไม่มีหมวด") })}</p>
        </header>
        {approve?.intro}

        <label className="grid gap-1.5">
          <span className="font-semibold">{t("หมวด › ชนิด › ส่วน")}</span>
          <select
            className="input"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("— ไม่มีหมวด —")}</option>
            {tree.map((c) => (
              <option key={c.id} value={c.id}>
                {"   ".repeat(c.level - 1)}
                {c.name} ({t(LEVEL_LABEL[c.level])})
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="font-semibold">{t("ชื่อไทย")}</span>
            <input className="input" value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder={t("เช่น สันใน")} required />
          </label>
          <label className="grid gap-1.5">
            <span className="font-semibold">
              {t("ชื่ออังกฤษ")} <span className="font-normal text-muted">{t("(ไม่บังคับ)")}</span>
            </span>
            <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Tenderloin" />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 font-semibold">{t("หน่วยนับ")}</legend>
          <Chips
            label={t("หน่วยนับ")}
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
            options={[...catalog.units.map((u) => ({ value: u, label: u })), { value: "__custom", label: t("อื่นๆ…") }]}
          />
          {customUnit && (
            <input
              className="input"
              autoFocus
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={t("พิมพ์หน่วย เช่น กล่อง")}
              aria-label={t("หน่วยนับอื่น")}
            />
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">{t("เก็บที่")}</legend>
          <Chips
            label={t("จุดเก็บ")}
            value={locationId}
            onChange={setLocationId}
            options={catalog.locations.map((l) => ({ value: l.id, label: l.name }))}
          />
          {item && locationId !== item.locationId && (
            <p className="mt-2 text-sm text-warn">{t("ย้ายจุดเก็บ: รายการนี้จะไปอยู่ท้ายใบนับของจุดใหม่ตั้งแต่รอบนับที่ยังไม่ส่ง")}</p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="font-semibold">{t("ขั้นต่ำ (Par)")}</span>
            <span className="text-sm text-muted">{t("ต่ำกว่านี้แจ้งเตือน")}</span>
            <Stepper label={t("ขั้นต่ำ (Par)")} value={par} onChange={setPar} />
          </div>
          <label className="grid content-start gap-1.5">
            <span className="font-semibold">{t("ราคาทุนต่อหน่วย (฿)")}</span>
            <span className="text-sm text-muted">{t("ใช้คิดมูลค่าคงคลังและส่วนต่าง")}</span>
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
            <span className="text-sm text-muted">{t("ซ่อนยอดที่ระบบคิดไว้ ให้พนักงานนับของจริงทุกครั้ง เหมาะกับของราคาสูง")}</span>
          </span>
        </label>

        {item && (
          <label className="card flex items-start gap-3 p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <b className="block">{t("ใช้งานอยู่")}</b>
              <span className="text-sm text-muted">{t("ปิดแล้วรายการจะไม่อยู่ในใบนับ แต่ประวัติการนับและรายงานเดิมยังอยู่ครบ")}</span>
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
            {error}
          </p>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-2 pb-4">
          <Link href={back} className="btn">
            {t("ยกเลิก")}
          </Link>
          <button type="submit" className="btn btn-primary text-lg" disabled={pending || !valid}>
            {pending ? t("กำลังบันทึก…") : approve ? t("อนุมัติและเพิ่มในใบนับ") : t("บันทึก")}
          </button>
        </div>
      </form>
      {approve?.footer}
    </main>
  );
}
