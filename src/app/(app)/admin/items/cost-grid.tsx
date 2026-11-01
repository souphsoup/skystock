"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CostRow } from "@/lib/insights";
import { saveCostParAction } from "@/app/actions/console";
import { fmtBaht, fmtQty } from "@/components/status";
import { IconSearch } from "@/components/icons";
import { useT } from "@/i18n/client";

type Row = CostRow & { level: "out" | "low" | null };
type Edit = { unitCost: string; par: string };

export function CostGrid({ rows }: { rows: Row[] }) {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [inactive, setInactive] = useState(false);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const locations = [...new Set(rows.map((r) => r.locationName))];
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (inactive || r.active) &&
        (!loc || r.locationName === loc) &&
        (!needle || r.nameTh.toLowerCase().includes(needle) || r.nameEn.toLowerCase().includes(needle)),
    );
  }, [rows, q, loc, inactive]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const changed = Object.entries(edits).filter(([id, e]) => {
    const r = byId.get(Number(id))!;
    return Number(e.unitCost) !== r.unitCost || Number(e.par) !== r.par;
  });
  const invalid = changed.some(([, e]) => !valid(e.unitCost) || !valid(e.par));
  const missingCost = rows.filter((r) => r.active && !r.unitCost).length;

  const value = (r: Row, k: keyof Edit) => edits[r.id]?.[k] ?? String(r[k]);
  const set = (r: Row, k: keyof Edit, v: string) =>
    setEdits((e) => ({ ...e, [r.id]: { unitCost: value(r, "unitCost"), par: value(r, "par"), [k]: v } }));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveCostParAction(
        changed.map(([id, e]) => ({ id: Number(id), unitCost: Number(e.unitCost), par: Number(e.par) })),
      );
      if (res.error) return setMsg({ ok: false, text: res.error });
      setEdits({});
      setMsg({ ok: true, text: t("บันทึกแล้ว {n} รายการ", { n: res.saved ?? 0 }) });
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-60 flex-1">
          <IconSearch width={18} height={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            className="input min-h-10 pl-10 text-base"
            placeholder={t("ค้นหารายการ")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select className="input min-h-10 w-auto text-base" value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">{t("ทุกจุดเก็บ")}</option>
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <label className="flex min-h-10 items-center gap-2 px-2 text-sm">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
          {t("แสดงรายการที่ปิดใช้งาน")}
        </label>
      </div>

      {missingCost > 0 && (
        <p className="mb-3 rounded-xl bg-warn-soft px-4 py-2 text-sm text-warn">
          {t("ยังไม่ได้ใส่ราคาทุน {n} รายการ มูลค่าคงคลังและความสูญเสียจะต่ำกว่าจริง", { n: missingCost })}
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("รายการ")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("จุดเก็บ")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("คงเหลือล่าสุด")}</th>
              <th className="px-3 py-2 text-right font-medium">Par</th>
              <th className="px-3 py-2 text-right font-medium">{t("ราคาทุน (฿)")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("มูลค่า")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const dirty = !!changed.find(([id]) => Number(id) === r.id);
              return (
                <tr key={r.id} className={`border-t border-line ${dirty ? "bg-accent-soft" : ""} ${r.active ? "" : "opacity-60"}`}>
                  <td className="px-3 py-1.5">
                    {r.nameEn || r.nameTh} <span className="text-muted">({r.unit})</span>
                    {r.level && (
                      <span className={`pill ml-2 ${r.level === "out" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
                        {r.level === "out" ? t("หมด") : t("ต่ำกว่า Par")}
                      </span>
                    )}
                    {!r.active && <span className="pill ml-2 bg-line text-muted">{t("ปิดใช้งาน")}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-muted">{r.locationName}</td>
                  <td className="num px-3 py-1.5 text-right">{fmtQty(r.lastCounted)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <NumInput label={t("Par ของ {name}", { name: r.nameTh })} value={value(r, "par")} onChange={(v) => set(r, "par", v)} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <NumInput
                      label={t("ราคาทุนของ {name}", { name: r.nameTh })}
                      value={value(r, "unitCost")}
                      onChange={(v) => set(r, "unitCost", v)}
                    />
                  </td>
                  <td className="num px-3 py-1.5 text-right text-muted">
                    {r.lastCounted === null ? "–" : fmtBaht(r.lastCounted * (Number(value(r, "unitCost")) || 0))}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  {t("ไม่พบรายการที่ตรงกับตัวกรอง")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper/95 py-3 backdrop-blur">
        {msg && (
          <span role="status" className={`text-sm font-semibold ${msg.ok ? "text-ok" : "text-bad"}`}>
            {msg.text}
          </span>
        )}
        {invalid && <span className="text-sm text-bad">{t("ราคาทุนและ Par ต้องเป็นตัวเลข 0 ขึ้นไป")}</span>}
        <button type="button" className="btn btn-ghost" disabled={!changed.length || pending} onClick={() => setEdits({})}>
          {t("ยกเลิก")}
        </button>
        <button type="button" className="btn btn-primary" disabled={!changed.length || invalid || pending} onClick={save}>
          {pending ? t("กำลังบันทึก…") : t("บันทึก {n} รายการ", { n: changed.length })}
        </button>
      </div>
    </>
  );
}

const valid = (v: string) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000;

function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      className={`num w-24 rounded-lg border bg-surface px-2 py-1 text-right ${valid(value) ? "border-line" : "border-bad"}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
