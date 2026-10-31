import Link from "next/link";
import { notFound } from "next/navigation";
import { HttpError, requireUser } from "@/lib/session";
import { getReview } from "@/lib/stock";
import { fmtTime, fmtWeekday } from "@/lib/dates";
import { can } from "@/lib/types";
import { CountStatusPill, fmtQty } from "@/components/status";
import { IconBack } from "@/components/icons";
import { ApproveMatchedButton, FlaggedLine } from "./review-actions";
import { getT } from "@/i18n/server";

export default async function ReviewPage({ params }: PageProps<"/review/[countId]">) {
  const user = await requireUser(can.review);
  const { t, lang } = await getT();
  const countId = Number((await params).countId);
  if (!Number.isInteger(countId) || countId <= 0) notFound();
  let review;
  try {
    review = await getReview(user, countId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const flagged = review.lines.filter((l) => l.status === "flag");
  const recount = review.lines.filter((l) => l.status === "recount");
  const matched = review.lines.filter((l) => l.status === "ok");
  const confirmed = review.lines.filter((l) => l.status === "confirmed");
  const pending = review.lines.filter((l) => l.status === "pending");
  const active = review.status === "submitted" || review.status === "recount";

  return (
    <main className="mx-auto max-w-xl px-4 pt-4">
      <Link href="/review" className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
        <IconBack width={18} height={18} /> {t("รายการรอตรวจ")}
      </Link>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {review.locationName}
            {review.submittedBy && ` · ${t("ส่งโดย {name}", { name: review.submittedBy })}`}
            {review.submittedAt && ` ${fmtTime(review.submittedAt, lang)}`}
          </p>
          <h1 className="text-2xl font-bold">{t("ตรวจยอดนับ {date}", { date: fmtWeekday(review.businessDate, lang) })}</h1>
        </div>
        <CountStatusPill status={review.status} lang={lang} />
      </header>

      {review.status === "draft" && (
        <p className="card mb-4 p-4 text-muted">
          {t("ยังนับไม่เสร็จ นับแล้ว {done} จาก {total} รายการ", {
            done: review.lines.length - pending.length,
            total: review.lines.length,
          })}
        </p>
      )}

      {active && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <span className="num block text-3xl font-bold text-ok">{matched.length + confirmed.length}</span>
            <span className="text-sm text-muted">✓ {t("รายการตรงกัน / ยืนยันแล้ว")}</span>
          </div>
          <div className={`card p-4 ${flagged.length ? "border-warn" : ""}`}>
            <span className={`num block text-3xl font-bold ${flagged.length ? "text-warn" : "text-muted"}`}>{flagged.length}</span>
            <span className="text-sm text-muted">⚠ {t("รายการต้องดู")}</span>
          </div>
        </div>
      )}

      {flagged.length > 0 && (
        <section className="mb-5" aria-labelledby="flagged">
          <h2 id="flagged" className="mb-2 font-semibold">
            {t("ยอดต่างจากที่ควรเหลือ")}
          </h2>
          <ul className="grid gap-3">
            {flagged.map((l) => (
              <FlaggedLine key={l.itemId} countId={review.countId} line={l} />
            ))}
          </ul>
        </section>
      )}

      {recount.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-semibold">{t("รอพนักงานนับซ้ำ")}</h2>
          <ul className="card divide-y divide-line">
            {recount.map((l) => (
              <li key={l.itemId} className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold">{l.name}</span>
                <span className="pill bg-bad-soft text-bad">↺ {t("นับซ้ำ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {matched.length + confirmed.length > 0 && (
        <details className="card mb-5" open={!active}>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">
            {t("รายการที่ตรงกันและยืนยันแล้ว ({n})", { n: matched.length + confirmed.length })}
          </summary>
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr className="border-t border-line">
                <th className="px-4 py-2 text-left font-medium">{t("รายการ")}</th>
                <th className="px-2 py-2 text-right font-medium">in</th>
                <th className="px-2 py-2 text-right font-medium">out</th>
                <th className="px-4 py-2 text-right font-medium">total</th>
              </tr>
            </thead>
            <tbody>
              {[...matched, ...confirmed].map((l) => (
                <tr key={l.itemId} className="border-t border-line">
                  <td className="px-4 py-2">
                    {l.name} <span className="text-muted">({l.unit})</span>
                    {l.variance ? <span className="ml-1 text-warn">{t("ต่าง {n}", { n: fmtQty(l.variance) })}</span> : null}
                  </td>
                  <td className="num px-2 py-2 text-right">{fmtQty(l.inQty)}</td>
                  <td className="num px-2 py-2 text-right">{fmtQty(l.outQty)}</td>
                  <td className="num px-4 py-2 text-right font-semibold">{fmtQty(l.counted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {active && matched.length > 0 && <ApproveMatchedButton countId={review.countId} count={matched.length} />}
    </main>
  );
}
