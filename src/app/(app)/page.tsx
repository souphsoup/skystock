import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { reviewQueue, stockAlerts, todayTasks } from "@/lib/stock";
import { countSignups } from "@/lib/signup";
import { businessDate, fmtWeekday } from "@/lib/dates";
import { can } from "@/lib/types";
import { fmtQty } from "@/components/status";
import { TaskList } from "@/components/task-list";
import { SyncBadge } from "@/components/sync-badge";
import { IconAlert, IconBox, IconSwap, IconTrash, IconTruck, IconUser } from "@/components/icons";
import { getT } from "@/i18n/server";

export default async function HomePage() {
  const user = await requireUser();
  if (!can.count(user.role)) redirect("/dashboard");
  const { t, lang } = await getT();

  const [tasks, alerts, queue, signups] = await Promise.all([
    todayTasks(user),
    stockAlerts(user),
    can.review(user.role) ? reviewQueue(user) : Promise.resolve(null),
    can.users(user.role) ? countSignups(user) : Promise.resolve(0),
  ]);
  const open = tasks.filter((task) => task.status === null || task.status === "draft" || task.status === "recount");
  const next = open.find((task) => task.status === "recount") ?? open[0];
  const recountTasks = tasks.filter((task) => task.status === "recount");

  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{fmtWeekday(businessDate(), lang)}</p>
          <h1 className="text-2xl font-bold">{t("สวัสดี คุณ{name}", { name: user.name })}</h1>
        </div>
        <SyncBadge />
      </header>

      {signups > 0 && (
        <Link
          href="/settings/users"
          className="mb-3 flex items-center gap-3 rounded-2xl border border-accent bg-accent-soft p-4"
        >
          <IconUser className="text-accent" />
          <span className="flex-1 font-semibold">{t("มีคนสมัครใช้งาน รออนุมัติ {n} คน", { n: signups })}</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </Link>
      )}

      {recountTasks.map((task) => (
        <Link
          key={task.locationId}
          href={`/count/${task.locationId}`}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-bad bg-bad-soft p-4 text-bad"
        >
          <IconAlert />
          <span className="font-semibold">
            {t("หัวหน้าขอให้นับซ้ำ {n} รายการที่ {location}", { n: task.recount, location: task.locationName })}
          </span>
        </Link>
      ))}

      {next ? (
        <section className="card mb-5 p-5" aria-labelledby="next-task">
          <p className="text-sm font-semibold text-accent">{t("งานถัดไป · ก่อน {time}", { time: next.dueTime })}</p>
          <h2 id="next-task" className="mt-1 text-xl font-bold">
            {next.status === "recount"
              ? t("นับซ้ำ {location}", { location: next.locationName })
              : t("นับ {location} ประจำวัน", { location: next.locationName })}
          </h2>
          <p className="mt-1 text-muted">
            {t("{n} รายการ", { n: next.items })}
            {next.status === "draft" && ` · ${t("นับแล้ว {n}", { n: next.counted })}`}
          </p>
          <Link href={`/count/${next.locationId}`} className="btn btn-primary mt-4 w-full text-lg">
            {next.status === "draft" ? t("นับต่อ") : next.status === "recount" ? t("เริ่มนับซ้ำ") : t("เริ่มนับ")}
          </Link>
        </section>
      ) : tasks.length === 0 ? (
        <section className="card mb-5 p-5">
          <h2 className="font-bold">{t("ยังไม่มีรายการสินค้าให้นับ")}</h2>
          <p className="mt-1 text-sm text-muted">
            {can.settings(user.role)
              ? t("เพิ่มวัตถุดิบในหน้าตั้งค่าก่อน แล้วงานนับจะขึ้นที่นี่")
              : t("ให้หัวหน้าหรือแอดมินเพิ่มรายการวัตถุดิบก่อน")}
          </p>
          {can.settings(user.role) && (
            <Link href="/settings" className="btn btn-primary mt-4 w-full">
              {t("ไปหน้าตั้งค่า")}
            </Link>
          )}
        </section>
      ) : (
        <section className="card mb-5 flex items-center gap-3 p-5">
          <span className="text-2xl text-ok" aria-hidden>
            ✓
          </span>
          <div>
            <h2 className="font-bold">{t("นับครบทุกจุดแล้ววันนี้")}</h2>
            <p className="text-sm text-muted">{t("ยอดถูกส่งให้หัวหน้าตรวจเรียบร้อย")}</p>
          </div>
        </section>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3" aria-label={t("งานหลัก")}>
        <Link
          href={
            tasks.length > 1
              ? "/count"
              : tasks.length
                ? `/count/${tasks[0].locationId}`
                : can.settings(user.role)
                  ? "/settings"
                  : "/"
          }
          className="card flex min-h-28 flex-col justify-between border-accent/40 p-4"
        >
          <IconBox className="text-accent" width={28} height={28} />
          <span>
            <b className="block">{t("นับสต๊อก")}</b>
            <span className="text-sm text-muted">{tasks.map((task) => task.locationName).join(" · ")}</span>
          </span>
        </Link>
        {[
          { href: "/receive", label: t("รับของเข้า"), sub: t("ถ่ายรูปใบส่งของ"), Icon: IconTruck, cls: "text-ok" },
          { href: "/move", label: t("เบิก / โอน"), sub: t("เข้าครัว · ชั้น 22 ↔ 24"), Icon: IconSwap, cls: "text-sky" },
          { href: "/waste", label: t("ของเสีย"), sub: t("หมดอายุ · ทำหก"), Icon: IconTrash, cls: "text-bad" },
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
        {t("ประวัติรับ · เบิก · โอน · ของเสีย")}
      </Link>

      {alerts.length > 0 && (
        <Link href="/alerts" className="mb-5 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn-soft p-4">
          <IconAlert className="mt-0.5 shrink-0 text-warn" />
          <span>
            <b className="block">
              {alerts
                .slice(0, 3)
                .map((a) =>
                  a.level === "out"
                    ? t("{name} หมดแล้ว", { name: a.name })
                    : t("{name} เหลือ {qty}", { name: a.name, qty: fmtQty(a.counted) }),
                )
                .join(" · ")}
              {alerts.length > 3 && ` ${t("และอีก {n} รายการ", { n: alerts.length - 3 })}`}
            </b>
            <span className="text-sm text-muted">{t("ต่ำกว่าจำนวนขั้นต่ำ (Par) ดูรายการที่ต้องสั่ง")}</span>
          </span>
        </Link>
      )}

      {queue && queue.pending.length > 0 && (
        <Link href="/review" className="card mb-5 flex items-center justify-between p-4">
          <span>
            <b className="block">{t("รอตรวจและอนุมัติ")}</b>
            <span className="text-sm text-muted">
              {queue.pending
                .map((q) => (q.flagged ? t("{location} (ต้องดู {n})", { location: q.locationName, n: q.flagged }) : q.locationName))
                .join(" · ")}
            </span>
          </span>
          <span className="num text-2xl font-bold text-accent">{queue.pending.length}</span>
        </Link>
      )}

      <section aria-labelledby="today-points">
        <h2 id="today-points" className="mb-2 text-sm font-semibold text-muted">
          {t("จุดนับวันนี้")}
        </h2>
        <TaskList tasks={tasks} />
      </section>
    </main>
  );
}
