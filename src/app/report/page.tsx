import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { overview, reportRows, stockAlerts, type ReportRow } from "@/lib/stock";
import { listMovements, wasteValue } from "@/lib/movements";
import { KIND_LABEL, wasteReasonLabel } from "@/lib/movement-types";
import { businessDate, daysBetween, fmtDateTime, fmtDay, fmtRange, fmtTime, reportRange, type Period } from "@/lib/dates";
import { can } from "@/lib/types";
import { fmtBaht, fmtQty, fmtSigned } from "@/components/status";
import { getT } from "@/i18n/server";
import { PrintButton } from "./print-button";

// Printable version of the dashboard: the browser's print dialog saves it as PDF,
// so Thai text renders exactly as on screen. Same data as the Excel export.

const toPeriod = (p: string | string[] | undefined): Period => (p === "day" || p === "month" ? p : "week");

export async function generateMetadata({ searchParams }: PageProps<"/report">): Promise<Metadata> {
  const { from, to } = reportRange(await searchParams);
  // Browsers use the title as the default PDF file name.
  return { title: `meStock_${from}_${to}` };
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const user = await requireUser(can.dashboard);
  const { t, lang } = await getT();
  const sp = await searchParams;
  const period = toPeriod(sp.period);
  const { from, to } = reportRange(sp);
  // opened from the console (/admin/stock) → go back there
  const back = sp.from ? "/admin/stock" : `/dashboard?period=${period}`;
  const [ov, rows, alerts, waste, moves] = await Promise.all([
    overview(user, from, to),
    reportRows(user, from, to),
    stockAlerts(user),
    wasteValue(user, from, to),
    listMovements(user, Math.max(45, daysBetween(from, businessDate()).length)),
  ]);

  const byLocation = new Map<string, ReportRow[]>();
  for (const r of rows) byLocation.set(r.locationName, [...(byLocation.get(r.locationName) ?? []), r]);
  const inPeriod = moves.filter((m) => {
    const date = businessDate(new Date(m.recordedAt));
    return date >= from && date <= to;
  });
  const varianceValue = Math.round(ov.variances.reduce((s, x) => s + x.value, 0));
  const th = "px-2 py-1.5 font-medium";

  return (
    <main className="report mx-auto max-w-4xl px-4 py-5 text-sm print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link href={back} className="btn min-h-10 px-3 text-sm">
          ‹ {t("ภาพรวม")}
        </Link>
        <PrintButton />
      </div>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-2">
        <div>
          <p className="text-muted">meStock · MAI The Sky Bar</p>
          <h1 className="text-xl font-bold">
            {t("รายงานสต็อก")} · {fmtRange(from, to, lang)}
          </h1>
        </div>
        <p className="text-xs text-muted">
          {t("พิมพ์เมื่อ {at} โดย {name}", { at: fmtDateTime(new Date(), lang), name: user.name })}
        </p>
      </header>

      <section className="mb-4 grid grid-cols-4 gap-2">
        <Kpi label={t("วันที่นับครบทุกจุด")} value={`${ov.completeDays}/${ov.days}`} bad={ov.completeDays < ov.days}>
          {ov.locationNames.join(" · ")}
        </Kpi>
        <Kpi label={t("มูลค่าคงคลัง")} value={fmtBaht(ov.inventoryValue)}>
          {t("ยอดนับล่าสุด × ราคาทุน")}
        </Kpi>
        <Kpi label={t("มูลค่าส่วนต่าง")} value={fmtBaht(varianceValue)} bad={varianceValue < 0} />
        <Kpi label={t("ของเสีย")} value={fmtBaht(waste)} bad={waste > 0} />
      </section>

      {(ov.pendingReview > 0 || ov.outOfStock.length > 0 || ov.variances.length > 0) && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1 font-semibold">{t("เรื่องที่ต้องจัดการ")}</h2>
          <ul className="list-disc pl-5">
            {ov.pendingReview > 0 && <li>{t("รอหัวหน้าอนุมัติ {n} รอบนับ", { n: ov.pendingReview })}</li>}
            {ov.outOfStock.map((o) => (
              <li key={o.name}>{t("{name} หมดสต็อก {days} วัน", { name: o.name, days: o.days })}</li>
            ))}
            {ov.variances.map((v, i) => (
              <li key={i}>
                {v.name} · {v.locationName} · {fmtDay(v.date, lang)}:{" "}
                <span className="num">{fmtSigned(v.variance)}</span> {v.unit} (<span className="num">{fmtBaht(v.value)}</span>)
              </li>
            ))}
          </ul>
        </section>
      )}

      {alerts.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1 font-semibold">{t("ต่ำกว่า Par · ต้องสั่ง")}</h2>
          <table className="w-full">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className={th}>{t("รายการ")}</th>
                <th className={th}>{t("จุดเก็บ")}</th>
                <th className={`${th} text-right`}>{t("คงเหลือ")}</th>
                <th className={`${th} text-right`}>Par</th>
                <th className={th}>{t("หน่วย")}</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={`${a.itemId}-${a.locationName}`} className="border-b border-line">
                  <td className="px-2 py-1">{a.name}</td>
                  <td className="px-2 py-1">{a.locationName}</td>
                  <td className={`num px-2 py-1 text-right ${a.level === "out" ? "font-semibold text-bad" : ""}`}>
                    {a.level === "out" ? t("หมด") : fmtQty(a.counted)}
                  </td>
                  <td className="num px-2 py-1 text-right">{fmtQty(a.par)}</td>
                  <td className="px-2 py-1">{a.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {byLocation.size === 0 && <p className="mb-4 text-muted">{t("ยังไม่มียอดที่ส่งแล้วในช่วงนี้")}</p>}
      {[...byLocation].map(([loc, list]) => (
        <section key={loc} className="mb-4">
          <h2 className="mb-1 font-semibold">
            {loc} · {fmtRange(from, to, lang)}
          </h2>
          <table className="w-full">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className={th}>{t("รายการ")}</th>
                <th className={th}>{t("หน่วย")}</th>
                <th className={`${th} text-right`}>in</th>
                <th className={`${th} text-right`}>out</th>
                <th className={`${th} text-right`}>total</th>
                <th className={`${th} text-right`}>{t("ส่วนต่าง")}</th>
                <th className={`${th} text-right`}>{t("มูลค่า")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.itemId} className="border-b border-line break-inside-avoid">
                  <td className="px-2 py-1">
                    {r.name}
                    {r.nameTh && r.nameTh !== r.name && <span className="text-muted"> · {r.nameTh}</span>}
                  </td>
                  <td className="px-2 py-1">{r.unit}</td>
                  <td className="num px-2 py-1 text-right">{fmtQty(r.inSum)}</td>
                  <td className="num px-2 py-1 text-right">{fmtQty(r.outSum)}</td>
                  <td className={`num px-2 py-1 text-right font-semibold ${r.closing === 0 ? "text-bad" : ""}`}>
                    {fmtQty(r.closing)}
                  </td>
                  <td className={`num px-2 py-1 text-right ${r.variance < 0 ? "text-bad" : r.variance > 0 ? "text-warn" : "text-muted"}`}>
                    {r.variance ? fmtSigned(r.variance) : "–"}
                  </td>
                  <td className="num px-2 py-1 text-right">{fmtBaht(r.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-2 py-1.5" colSpan={6}>
                  {t("รวม")}
                </td>
                <td className="num px-2 py-1.5 text-right">{fmtBaht(list.reduce((s, r) => s + r.value, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}

      {inPeriod.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 font-semibold">{t("รับ-เบิก-โอน-ของเสีย")}</h2>
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className={th}>{t("วันที่")}</th>
                <th className={th}>{t("ประเภท")}</th>
                <th className={th}>{t("รายการ")}</th>
                <th className={`${th} text-right`}>{t("จำนวน")}</th>
                <th className={th}>{t("จาก")} → {t("ไป")}</th>
                <th className={th}>{t("ซัพพลายเออร์ / สาเหตุ")}</th>
                <th className={th}>{t("บันทึกโดย")}</th>
              </tr>
            </thead>
            <tbody>
              {inPeriod.flatMap((m) => {
                const why = [
                  m.supplier ?? (m.reason ? (wasteReasonLabel(m.reason) ? t(wasteReasonLabel(m.reason)!) : m.reason) : null),
                  m.note,
                  m.voidedAt ? t("ยกเลิก: {reason}", { reason: m.voidReason ?? "" }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return m.lines.map((l, i) => (
                  <tr key={`${m.id}-${i}`} className={`border-b border-line break-inside-avoid ${m.voidedAt ? "text-muted line-through" : ""}`}>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {fmtDay(businessDate(new Date(m.recordedAt)), lang)} <span className="num">{fmtTime(m.recordedAt, lang)}</span>
                    </td>
                    <td className="px-2 py-1">{t(KIND_LABEL[m.kind])}</td>
                    <td className="px-2 py-1">{l.name}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <span className="num">{fmtQty(l.qty)}</span> {l.unit}
                    </td>
                    <td className="px-2 py-1">{[m.fromName, m.toName].filter(Boolean).join(" → ")}</td>
                    <td className="px-2 py-1">{why}</td>
                    <td className="px-2 py-1">{m.createdBy}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function Kpi({ label, value, bad, children }: { label: string; value: string; bad?: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-2 break-inside-avoid">
      <span className="block text-xs text-muted">{label}</span>
      <b className={`num block text-lg ${bad ? "text-bad" : ""}`}>{value}</b>
      {children && <span className="block text-xs text-muted">{children}</span>}
    </div>
  );
}
