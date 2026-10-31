import Link from "next/link";
import { requireUser } from "@/lib/session";
import { overview, reportRows, stockAlerts, type ReportRow } from "@/lib/stock";
import { wasteValue } from "@/lib/movements";
import { fmtDay, fmtRange, periodRange, type Period } from "@/lib/dates";
import { can, ROLE_LABEL } from "@/lib/types";
import { fmtBaht, fmtQty, fmtSigned } from "@/components/status";
import { IconAlert, IconDownload } from "@/components/icons";
import { tk } from "@/i18n";
import { getT } from "@/i18n/server";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: tk("วัน") },
  { key: "week", label: tk("สัปดาห์") },
  { key: "month", label: tk("เดือน") },
];

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser(can.dashboard);
  const { t, lang } = await getT();
  const p = (await searchParams).period;
  const period: Period = p === "day" || p === "month" ? p : "week";
  const { from, to } = periodRange(period);
  const [ov, rows, alerts, waste] = await Promise.all([
    overview(user, from, to),
    reportRows(user, from, to),
    stockAlerts(user),
    wasteValue(user, from, to),
  ]);

  const byLocation = new Map<string, ReportRow[]>();
  for (const r of rows) byLocation.set(r.locationName, [...(byLocation.get(r.locationName) ?? []), r]);
  const allDone = ov.completeDays === ov.days;
  // {count} is left in place and split off so the numbers keep their own styling.
  const [donePre, donePost] = (
    allDone
      ? t("นับครบทุกจุด {count} วัน", { days: ov.days })
      : t("ยังนับไม่ครบทุกจุด {count} วัน", { days: ov.days })
  ).split("{count}");

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">MAI The Sky Bar · {t(ROLE_LABEL[user.role])}</p>
          <h1 className="text-2xl font-bold">{t("ภาพรวม")}</h1>
        </div>
        <nav className="flex rounded-xl border border-line bg-surface p-1" aria-label={t("ช่วงเวลา")}>
          {PERIODS.map((x) => (
            <Link
              key={x.key}
              href={`/dashboard?period=${x.key}`}
              aria-current={period === x.key ? "page" : undefined}
              className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold ${
                period === x.key ? "bg-accent text-accent-ink" : "text-muted"
              }`}
            >
              {t(x.label)}
            </Link>
          ))}
        </nav>
      </header>

      <section
        className={`mb-4 flex items-center gap-3 rounded-2xl border p-4 ${
          allDone ? "border-ok/40 bg-ok-soft" : "border-warn/40 bg-warn-soft"
        }`}
      >
        <span className={`text-2xl ${allDone ? "text-ok" : "text-warn"}`} aria-hidden>
          {allDone ? "✓" : "◐"}
        </span>
        <div>
          <b className="block">
            {donePre}
            <span className="num">
              {ov.completeDays}/{ov.days}
            </span>
            {donePost}
          </b>
          <span className="text-sm text-muted">
            {ov.locationNames.join(" · ")} · {fmtRange(from, to, lang)}
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-4">
          <section className="card p-4" aria-labelledby="todo">
            <h2 id="todo" className="mb-2 font-semibold">
              {t("เรื่องที่ต้องจัดการ")}
            </h2>
            <ul className="grid gap-2">
              {ov.pendingReview > 0 && (
                <Issue tone="sky" title={t("รอหัวหน้าอนุมัติ {n} รอบนับ", { n: ov.pendingReview })} href="/review" />
              )}
              {ov.outOfStock.map((o) => (
                <Issue key={o.name} tone="bad" title={t("{name} หมดสต๊อก {days} วัน", { name: o.name, days: o.days })} />
              ))}
              {ov.variances.length > 0 && (
                <Issue
                  tone="warn"
                  title={t("ส่วนต่างผิดปกติ {n} รายการ", { n: ov.variances.length })}
                  detail={ov.variances
                    .slice(0, 4)
                    .map((v) => `${v.name} ${fmtSigned(v.variance)} ${v.unit} (${fmtDay(v.date, lang)})`)
                    .join(" · ")}
                />
              )}
              {ov.pendingReview === 0 && ov.outOfStock.length === 0 && ov.variances.length === 0 && (
                <li className="text-muted">{t("ไม่มีเรื่องผิดปกติในช่วงนี้")}</li>
              )}
            </ul>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <div className="card p-4">
              <span className="text-sm text-muted">{t("มูลค่าคงคลัง")}</span>
              <b className="num block text-2xl">{fmtBaht(ov.inventoryValue)}</b>
              <span className="text-xs text-muted">{t("ยอดนับล่าสุด × ราคาทุน")}</span>
            </div>
            <div className="card p-4">
              <span className="text-sm text-muted">{t("มูลค่าส่วนต่าง")}</span>
              <b className={`num block text-2xl ${sumValue(ov.variances) < 0 ? "text-bad" : ""}`}>
                {fmtBaht(sumValue(ov.variances))}
              </b>
              <span className="text-xs text-muted">{fmtRange(from, to, lang)}</span>
            </div>
            <Link href="/movements" className="card p-4">
              <span className="text-sm text-muted">{t("ของเสีย")}</span>
              <b className={`num block text-2xl ${waste > 0 ? "text-bad" : ""}`}>{fmtBaht(waste)}</b>
              <span className="text-xs text-muted">{t("ตามราคาทุน · ดูรายการ ›")}</span>
            </Link>
          </section>

          <Link href="/history" className="card flex min-h-14 items-center justify-between px-4">
            <span>
              <b className="block">{t("ประวัติการแก้ไข")}</b>
              <span className="text-sm text-muted">{t("ใครทำอะไร เมื่อไหร่")}</span>
            </span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>

          {alerts.length > 0 && (
            <section className="card p-4" aria-labelledby="reorder">
              <h2 id="reorder" className="mb-2 font-semibold">
                {t("ต่ำกว่า Par · ต้องสั่ง")}
              </h2>
              <ul className="divide-y divide-line text-sm">
                {alerts.map((a) => (
                  <li key={a.itemId} className="flex justify-between gap-2 py-2">
                    <span>
                      {a.name} <span className="text-muted">· {a.locationName}</span>
                    </span>
                    <span className="num">
                      {a.level === "out" ? <b className="text-bad">{t("หมด")}</b> : t("เหลือ {n}", { n: fmtQty(a.counted) })}
                      <span className="text-muted">
                        {" "}
                        / Par {fmtQty(a.par)} {a.unit}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="grid content-start gap-4">
          {byLocation.size === 0 && <p className="card p-5 text-muted">{t("ยังไม่มียอดที่ส่งแล้วในช่วงนี้")}</p>}
          {[...byLocation].map(([loc, list]) => (
            <section key={loc} className="card overflow-hidden" aria-label={t("รายงาน {loc}", { loc })}>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <h2 className="font-semibold">
                  {loc} · {fmtRange(from, to, lang)}
                </h2>
                <a href={`/api/reports/export?period=${period}`} className="btn min-h-10 px-3 text-sm" download>
                  <IconDownload width={16} height={16} /> Excel
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted">
                    <tr className="border-t border-line">
                      <th className="px-4 py-2 text-left font-medium">{t("รายการ")}</th>
                      <th className="px-2 py-2 text-right font-medium">in</th>
                      <th className="px-2 py-2 text-right font-medium">out</th>
                      <th className="px-2 py-2 text-right font-medium">total</th>
                      <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t("ส่วนต่าง")}</th>
                      <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">{t("มูลค่า")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.itemId} className="border-t border-line">
                        <td className="px-4 py-2">
                          {r.name} <span className="text-muted">({r.unit})</span>
                        </td>
                        <td className="num px-2 py-2 text-right">{fmtQty(r.inSum)}</td>
                        <td className="num px-2 py-2 text-right">{fmtQty(r.outSum)}</td>
                        <td className={`num px-2 py-2 text-right font-semibold ${r.closing === 0 ? "text-bad" : ""}`}>
                          {fmtQty(r.closing)}
                        </td>
                        <td
                          className={`num hidden px-2 py-2 text-right sm:table-cell ${
                            r.variance < 0 ? "text-bad" : r.variance > 0 ? "text-warn" : "text-muted"
                          }`}
                        >
                          {r.variance ? fmtSigned(r.variance) : "–"}
                        </td>
                        <td className="num hidden px-4 py-2 text-right sm:table-cell">{fmtBaht(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

const sumValue = (v: { value: number }[]) => Math.round(v.reduce((s, x) => s + x.value, 0));

function Issue({
  tone,
  title,
  detail,
  href,
}: {
  tone: "bad" | "warn" | "sky";
  title: string;
  detail?: string;
  href?: string;
}) {
  const cls = { bad: "bg-bad-soft text-bad", warn: "bg-warn-soft text-warn", sky: "bg-sky-soft text-sky" }[tone];
  const body = (
    <>
      <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
      <span>
        <b className="block">{title}</b>
        {detail && <span className="text-sm opacity-90">{detail}</span>}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={`flex gap-2 rounded-xl px-3 py-2 ${cls}`}>
          {body}
        </Link>
      ) : (
        <div className={`flex gap-2 rounded-xl px-3 py-2 ${cls}`}>{body}</div>
      )}
    </li>
  );
}
