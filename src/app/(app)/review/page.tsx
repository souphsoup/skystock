import Link from "next/link";
import { requireUser } from "@/lib/session";
import { reviewQueue, type QueueItem } from "@/lib/stock";
import { fmtTime, fmtWeekday } from "@/lib/dates";
import { can } from "@/lib/types";
import { CountStatusPill, PageHeader } from "@/components/status";

export default async function ReviewListPage() {
  const user = await requireUser(can.review);
  const { pending, recent } = await reviewQueue(user);
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow="หัวหน้าครัว / Bar Supervisor" title="ตรวจและอนุมัติยอด" />
      {pending.length === 0 ? (
        <p className="card p-5 text-muted">ไม่มียอดนับที่รอตรวจ</p>
      ) : (
        <ul className="grid gap-3">
          {pending.map((q) => (
            <QueueCard key={q.countId} q={q} />
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">อนุมัติล่าสุด</h2>
          <ul className="grid gap-2">
            {recent.map((q) => (
              <QueueCard key={q.countId} q={q} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function QueueCard({ q }: { q: QueueItem }) {
  return (
    <li>
      <Link href={`/review/${q.countId}`} className="card flex items-center justify-between gap-3 p-4">
        <span>
          <b className="block">
            {q.locationName} · {fmtWeekday(q.businessDate)}
          </b>
          <span className="text-sm text-muted">
            {q.submittedBy ? `ส่งโดย ${q.submittedBy}` : ""}
            {q.submittedAt ? ` ${fmtTime(q.submittedAt)}` : ""} · {q.total} รายการ
            {q.flagged > 0 && ` · ต้องดู ${q.flagged}`}
            {q.recount > 0 && ` · รอนับซ้ำ ${q.recount}`}
          </span>
        </span>
        <CountStatusPill status={q.status} />
      </Link>
    </li>
  );
}
