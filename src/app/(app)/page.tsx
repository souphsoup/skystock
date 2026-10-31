import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { reviewQueue, stockAlerts, todayTasks } from "@/lib/stock";
import { businessDate, fmtWeekday } from "@/lib/dates";
import { can } from "@/lib/types";
import { CountStatusPill, fmtQty } from "@/components/status";
import { SyncBadge } from "@/components/sync-badge";
import { IconAlert, IconBox, IconSwap, IconTrash, IconTruck } from "@/components/icons";

export default async function HomePage() {
  const user = await requireUser();
  if (!can.count(user.role)) redirect("/dashboard");

  const [tasks, alerts, queue] = await Promise.all([
    todayTasks(user),
    stockAlerts(user),
    can.review(user.role) ? reviewQueue(user) : Promise.resolve(null),
  ]);
  const open = tasks.filter((t) => t.status === null || t.status === "draft" || t.status === "recount");
  const next = open.find((t) => t.status === "recount") ?? open[0];
  const recountTasks = tasks.filter((t) => t.status === "recount");

  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{fmtWeekday(businessDate())}</p>
          <h1 className="text-2xl font-bold">สวัสดี คุณ{user.name}</h1>
        </div>
        <SyncBadge />
      </header>

      {recountTasks.map((t) => (
        <Link
          key={t.locationId}
          href={`/count/${t.locationId}`}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-bad bg-bad-soft p-4 text-bad"
        >
          <IconAlert />
          <span className="font-semibold">
            หัวหน้าขอให้นับซ้ำ {t.recount} รายการที่ {t.locationName}
          </span>
        </Link>
      ))}

      {next ? (
        <section className="card mb-5 p-5" aria-labelledby="next-task">
          <p className="text-sm font-semibold text-accent">งานถัดไป · ก่อน {next.dueTime}</p>
          <h2 id="next-task" className="mt-1 text-xl font-bold">
            {next.status === "recount" ? `นับซ้ำ ${next.locationName}` : `นับ ${next.locationName} ประจำวัน`}
          </h2>
          <p className="mt-1 text-muted">
            {next.items} รายการ
            {next.status === "draft" && ` · นับแล้ว ${next.counted}`}
          </p>
          <Link href={`/count/${next.locationId}`} className="btn btn-primary mt-4 w-full text-lg">
            {next.status === "draft" ? "นับต่อ" : next.status === "recount" ? "เริ่มนับซ้ำ" : "เริ่มนับ"}
          </Link>
        </section>
      ) : (
        <section className="card mb-5 flex items-center gap-3 p-5">
          <span className="text-2xl text-ok" aria-hidden>
            ✓
          </span>
          <div>
            <h2 className="font-bold">นับครบทุกจุดแล้ววันนี้</h2>
            <p className="text-sm text-muted">ยอดถูกส่งให้หัวหน้าตรวจเรียบร้อย</p>
          </div>
        </section>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3" aria-label="งานหลัก">
        <Link
          href={`/count/${(next ?? tasks[0])?.locationId ?? ""}`}
          className="card flex min-h-28 flex-col justify-between border-accent/40 p-4"
        >
          <IconBox className="text-accent" width={28} height={28} />
          <span>
            <b className="block">นับสต๊อก</b>
            <span className="text-sm text-muted">{tasks.map((t) => t.locationName).join(" · ")}</span>
          </span>
        </Link>
        {[
          { href: "/receive", label: "รับของเข้า", sub: "ถ่ายรูปใบส่งของ", Icon: IconTruck, cls: "text-ok" },
          { href: "/move", label: "เบิก / โอน", sub: "เข้าครัว · ชั้น 22 ↔ 24", Icon: IconSwap, cls: "text-sky" },
          { href: "/waste", label: "ของเสีย", sub: "หมดอายุ · ทำหก", Icon: IconTrash, cls: "text-bad" },
        ].map(({ href, label, sub, Icon, cls }) => (
          <Link key={href} href={href} className="card flex min-h-28 flex-col justify-between p-4">
            <Icon className={cls} width={28} height={28} />
            <span>
              <b className="block">{label}</b>
              <span className="text-sm text-muted">{sub}</span>
            </span>
          </Link>
        ))}
      </section>
      <Link href="/movements" className="-mt-3 mb-5 block text-right text-sm font-medium text-sky underline">
        ประวัติรับ · เบิก · โอน · ของเสีย
      </Link>

      {alerts.length > 0 && (
        <Link href="/alerts" className="mb-5 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn-soft p-4">
          <IconAlert className="mt-0.5 shrink-0 text-warn" />
          <span>
            <b className="block">
              {alerts
                .slice(0, 3)
                .map((a) => (a.level === "out" ? `${a.name} หมดแล้ว` : `${a.name} เหลือ ${fmtQty(a.counted)}`))
                .join(" · ")}
              {alerts.length > 3 && ` และอีก ${alerts.length - 3} รายการ`}
            </b>
            <span className="text-sm text-muted">ต่ำกว่าจำนวนขั้นต่ำ (Par) ดูรายการที่ต้องสั่ง</span>
          </span>
        </Link>
      )}

      {queue && queue.pending.length > 0 && (
        <Link href="/review" className="card mb-5 flex items-center justify-between p-4">
          <span>
            <b className="block">รอตรวจและอนุมัติ</b>
            <span className="text-sm text-muted">
              {queue.pending.map((q) => `${q.locationName}${q.flagged ? ` (ต้องดู ${q.flagged})` : ""}`).join(" · ")}
            </span>
          </span>
          <span className="num text-2xl font-bold text-accent">{queue.pending.length}</span>
        </Link>
      )}

      <section aria-labelledby="today-points">
        <h2 id="today-points" className="mb-2 text-sm font-semibold text-muted">
          จุดนับวันนี้
        </h2>
        <ul className="card divide-y divide-line">
          {tasks.map((t) => (
            <li key={t.locationId}>
              <Link href={`/count/${t.locationId}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <span>
                  <b>{t.locationName}</b>
                  <span className="block text-sm text-muted">
                    {t.counted}/{t.items} รายการ · ก่อน {t.dueTime}
                  </span>
                </span>
                <CountStatusPill status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
