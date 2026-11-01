"use client";

import { useMemo, useState } from "react";
import type { ReportRow } from "@/lib/stock";
import { fmtBaht, fmtQty, fmtSigned } from "@/components/status";
import { IconSearch } from "@/components/icons";
import { useT } from "@/i18n/client";

type Row = ReportRow & { level: "out" | "low" | null };
type Key = "name" | "locationName" | "inSum" | "outSum" | "closing" | "variance" | "value";

export function StockTable({ rows }: { rows: Row[] }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [only, setOnly] = useState<"" | "variance" | "low">("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 } | null>(null);

  const locations = [...new Set(rows.map((r) => r.locationName))];
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (!loc || r.locationName === loc) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.nameTh.toLowerCase().includes(needle)) &&
        (only !== "variance" || r.variance !== 0) &&
        (only !== "low" || r.level !== null),
    );
    if (sort) {
      out.sort((a, b) => {
        const x = a[sort.key] ?? -Infinity;
        const y = b[sort.key] ?? -Infinity;
        return (typeof x === "string" ? x.localeCompare(String(y), "th") : Number(x) - Number(y)) * sort.dir;
      });
    }
    return out;
  }, [rows, q, loc, only, sort]);
  const total = list.reduce((s, r) => s + r.value, 0);

  const th = (k: Key, label: string, right = false) => (
    <th
      key={k}
      className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}
      aria-sort={sort?.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        className="hover:text-ink"
        onClick={() => setSort(sort?.key === k ? { key: k, dir: sort.dir === 1 ? -1 : 1 } : { key: k, dir: right ? -1 : 1 })}
      >
        {label} {sort?.key === k ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

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
        <select
          className="input min-h-10 w-auto text-base"
          value={only}
          onChange={(e) => setOnly(e.target.value as typeof only)}
        >
          <option value="">{t("ทุกรายการ")}</option>
          <option value="variance">{t("เฉพาะที่มีส่วนต่าง")}</option>
          <option value="low">{t("เฉพาะที่ต่ำกว่า Par")}</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted">
            <tr>
              {th("name", t("รายการ"))}
              {th("locationName", t("จุดเก็บ"))}
              {th("inSum", "in", true)}
              {th("outSum", "out", true)}
              {th("closing", t("คงเหลือ"), true)}
              {th("variance", t("ส่วนต่าง"), true)}
              {th("value", t("มูลค่า"), true)}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={`${r.locationId}-${r.itemId}`} className="border-t border-line hover:bg-paper">
                <td className="px-3 py-2">
                  {r.name} <span className="text-muted">({r.unit})</span>
                  {r.level && (
                    <span className={`pill ml-2 ${r.level === "out" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
                      {r.level === "out" ? t("หมด") : t("ต่ำกว่า Par")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{r.locationName}</td>
                <td className="num px-3 py-2 text-right">{fmtQty(r.inSum)}</td>
                <td className="num px-3 py-2 text-right">{fmtQty(r.outSum)}</td>
                <td className={`num px-3 py-2 text-right font-semibold ${r.closing === 0 ? "text-bad" : ""}`}>
                  {fmtQty(r.closing)}
                </td>
                <td
                  className={`num px-3 py-2 text-right ${
                    r.variance < 0 ? "text-bad" : r.variance > 0 ? "text-warn" : "text-muted"
                  }`}
                >
                  {r.variance ? fmtSigned(r.variance) : "–"}
                </td>
                <td className="num px-3 py-2 text-right">{fmtBaht(r.value)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  {rows.length ? t("ไม่พบรายการที่ตรงกับตัวกรอง") : t("ยังไม่มียอดที่ส่งแล้วในช่วงนี้")}
                </td>
              </tr>
            )}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <td className="px-3 py-2" colSpan={6}>
                  {t("รวม {n} รายการ", { n: list.length })}
                </td>
                <td className="num px-3 py-2 text-right">{fmtBaht(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
