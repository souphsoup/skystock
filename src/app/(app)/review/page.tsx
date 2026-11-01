import Link from "next/link";
import { requireUser } from "@/lib/session";
import { reviewQueue, type QueueItem } from "@/lib/stock";
import { pendingProposals } from "@/lib/proposals";
import { fmtQty } from "@/components/status";
import { fmtTime, fmtWeekday } from "@/lib/dates";
import { can } from "@/lib/types";
import { CountStatusPill, PageHeader } from "@/components/status";
import { getT } from "@/i18n/server";
import { tk, type Lang, type TFn } from "@/i18n";

const COUNTED_NOTE: Record<string, string> = {
  draft: tk("ใส่ยอดที่นับได้ในใบนับวันนี้ให้แล้ว"),
  review: tk("เพิ่มยอดที่นับได้ในรอบนับที่รอตรวจแล้ว"),
  next: tk("จะเริ่มนับในรอบถัดไป"),
  none: tk("จะอยู่ในใบนับรอบถัดไป"),
};

export default async function ReviewListPage({ searchParams }: PageProps<"/review">) {
  const user = await requireUser(can.review);
  const { t, lang } = await getT();
  const [{ pending, recent }, proposals] = await Promise.all([reviewQueue(user), pendingProposals(user)]);
  const sp = await searchParams;
  const added = typeof sp.added === "string" ? sp.added.slice(0, 80) : null;
  const counted = typeof sp.counted === "string" ? COUNTED_NOTE[sp.counted] : undefined;
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow={t("หัวหน้าครัว / Bar Supervisor")} title={t("ตรวจและอนุมัติยอด")} />
      {added && (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
          ✓ {t("เพิ่ม {name} แล้ว", { name: added })}
          {counted ? ` · ${t(counted)}` : ""}
        </p>
      )}
      {proposals.length > 0 && (
        <section className="mb-5" aria-labelledby="proposals-h">
          <h2 id="proposals-h" className="mb-2 font-semibold">
            {t("รายการใหม่ที่พนักงานเสนอ ({n})", { n: proposals.length })}
          </h2>
          <ul className="grid gap-2">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link href={`/review/proposals/${p.id}`} className="card flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <b className="block truncate">{p.nameEn || p.nameTh}</b>
                    <span className="block truncate text-sm text-muted">
                      {[
                        p.nameEn ? p.nameTh : null,
                        p.locationName,
                        p.counted !== null ? t("นับได้ {n} {unit}", { n: fmtQty(p.counted), unit: p.unit }) : p.unit,
                        t("เสนอโดย {name}", { name: p.by }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="pill bg-warn-soft text-warn">{t("รออนุมัติ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pending.length === 0 ? (
        <p className="card p-5 text-muted">{t("ไม่มียอดนับที่รอตรวจ")}</p>
      ) : (
        <ul className="grid gap-3">
          {pending.map((q) => (
            <QueueCard key={q.countId} q={q} t={t} lang={lang} />
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">{t("อนุมัติล่าสุด")}</h2>
          <ul className="grid gap-2">
            {recent.map((q) => (
              <QueueCard key={q.countId} q={q} t={t} lang={lang} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function QueueCard({ q, t, lang }: { q: QueueItem; t: TFn; lang: Lang }) {
  return (
    <li>
      <Link href={`/review/${q.countId}`} className="card flex items-center justify-between gap-3 p-4">
        <span>
          <b className="block">
            {q.locationName} · {fmtWeekday(q.businessDate, lang)}
          </b>
          <span className="text-sm text-muted">
            {q.submittedBy ? t("ส่งโดย {name}", { name: q.submittedBy }) : ""}
            {q.submittedAt ? ` ${fmtTime(q.submittedAt, lang)}` : ""} · {t("{n} รายการ", { n: q.total })}
            {q.flagged > 0 && ` · ${t("ต้องดู {n}", { n: q.flagged })}`}
            {q.recount > 0 && ` · ${t("รอนับซ้ำ {n}", { n: q.recount })}`}
            {q.comments > 0 && ` · 💬 ${q.comments}`}
          </span>
        </span>
        <CountStatusPill status={q.status} lang={lang} />
      </Link>
    </li>
  );
}
