import Link from "next/link";
import { requireUser } from "@/lib/session";
import { usage, type FailedLogin, type UsageUser } from "@/lib/usage";
import { addDays, businessDate, fmtDateTime, fmtTime, fmtWeekday } from "@/lib/dates";
import { can, ROLE_LABEL } from "@/lib/types";
import { CountStatusPill, PageHeader } from "@/components/status";
import { tk, type TFn } from "@/i18n";
import { getT } from "@/i18n/server";
import { AutoRefresh } from "@/components/auto-refresh";

const DAYS = 7;

const REASON: Record<FailedLogin["reason"], string> = {
  bad_pin: tk("PIN ผิด"),
  locked: tk("บัญชีถูกล็อกชั่วคราว"),
  unknown: tk("ไม่มีชื่อผู้ใช้นี้ หรือถูกปิดใช้งาน"),
  pending: tk("สมัครแล้ว รอ Admin อนุมัติ"),
  throttled: tk("ใส่ผิดจาก IP เดียวกันเกินกำหนด"),
};

export default async function UsagePage({ searchParams }: PageProps<"/usage">) {
  const user = await requireUser(can.usage);
  const { t, lang } = await getT();
  const today = businessDate();
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, -i));
  const sp = (await searchParams).date;
  const date = dates.find((d) => d === sp) ?? today;
  const u = await usage(user, date);

  const t0 = new Date(`${date}T06:00:00+07:00`).getTime();
  const activeOn = (x: UsageUser) =>
    x.logins + x.lines + x.submits + x.movements + x.proposals + x.reviews > 0 ||
    (!!x.lastActiveAt && +new Date(x.lastActiveAt) >= t0 && +new Date(x.lastActiveAt) < t0 + 86_400_000);
  const active = u.users.filter(activeOn);
  const idle = u.users.filter((x) => !activeOn(x));
  const sum = (k: keyof Pick<UsageUser, "logins" | "lines" | "movements" | "proposals">) =>
    u.users.reduce((s, x) => s + x[k], 0);
  const sent = u.locations.filter((l) => l.status && l.status !== "draft").length;
  const online = u.users.filter((x) => x.online).length;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      {date === today && <AutoRefresh />}
      <PageHeader
        eyebrow={date === today ? t("อัปเดตเองทุก 1 นาที · {time}", { time: fmtTime(u.asOf, lang) }) : t("ติดตามการใช้งาน")}
        title={t("การใช้งานแอป")}
      />
      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label={t("วันทำการ")}>
        {dates.map((d) => (
          <Link
            key={d}
            href={d === today ? "/usage" : `/usage?date=${d}`}
            aria-current={d === date ? "page" : undefined}
            className={`min-h-10 shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${
              d === date ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted"
            }`}
          >
            {d === today ? t("วันนี้") : fmtWeekday(d, lang)}
          </Link>
        ))}
      </nav>

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label={t("สรุป")}>
        <Stat
          label={t("ผู้ใช้ที่เข้าใช้")}
          value={`${active.length}/${u.users.length}`}
          note={date === today ? t("ออนไลน์ตอนนี้ {n}", { n: online }) : undefined}
        />
        <Stat
          label={t("เข้าสู่ระบบ")}
          value={sum("logins")}
          note={u.failed.length ? t("ไม่สำเร็จ {n} ครั้ง", { n: u.failed.length }) : undefined}
          bad={u.failed.length > 0}
        />
        <Stat label={t("รายการที่นับ")} value={sum("lines")} />
        <Stat label={t("ส่งยอดนับ")} value={`${sent}/${u.locations.length}`} note={t("จุดเก็บ")} />
        <Stat label={t("รับ / เบิก / โอน / เสีย")} value={sum("movements")} note={t("ใบ")} />
        <Stat label={t("เสนอรายการใหม่")} value={sum("proposals")} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="grid content-start gap-4">
          <HourChart hours={u.hours} t={t} />

          <section className="card p-4" aria-labelledby="loc-h">
            <h2 id="loc-h" className="mb-3 font-semibold">
              {t("ความคืบหน้าการนับ")}
            </h2>
            <ul className="grid gap-3">
              {u.locations.map((l) => {
                const pct = l.total ? Math.round((l.counted / l.total) * 100) : 0;
                return (
                  <li key={l.id}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <b>{l.name}</b>
                      <CountStatusPill status={l.status} lang={lang} />
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-line"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={l.total}
                      aria-valuenow={l.counted}
                      aria-label={l.name}
                    >
                      <div
                        className={`h-full rounded-full ${l.status === "approved" ? "bg-ok" : "bg-accent"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {t("นับแล้ว {n}/{total} รายการ", { n: l.counted, total: l.total })}
                      {l.submittedAt &&
                        ` · ${t("ส่งโดย {name} {time}", { name: l.submittedBy ?? "–", time: fmtTime(l.submittedAt, lang) })}`}
                    </p>
                  </li>
                );
              })}
              {u.locations.length === 0 && <li className="text-muted">{t("ยังไม่มีจุดเก็บ")}</li>}
            </ul>
          </section>

          {u.failed.length > 0 && (
            <section className="card p-4" aria-labelledby="fail-h">
              <h2 id="fail-h" className="mb-2 font-semibold">
                {t("เข้าสู่ระบบไม่สำเร็จ")}
              </h2>
              <ul className="divide-y divide-line text-sm">
                {u.failed.map((f, i) => (
                  <li key={i} className="flex justify-between gap-2 py-2">
                    <span>
                      <b>{f.name ?? f.login}</b>
                      {f.name && <span className="text-muted"> ({f.login})</span>}
                      <span className="block text-muted">{t(REASON[f.reason])}</span>
                    </span>
                    <span className="text-muted">{fmtTime(f.at, lang)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="card overflow-hidden" aria-labelledby="users-h">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 id="users-h" className="font-semibold">
              {t("รายคน")}
            </h2>
            <Link href="/history" className="text-sm text-accent">
              {t("ประวัติการแก้ไข ›")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm lg:min-w-0">
              <thead className="text-muted">
                <tr className="border-t border-line">
                  <th className="px-4 py-2 text-left font-medium">{t("ผู้ใช้")}</th>
                  <th className="px-2 py-2 text-left font-medium">{t("ใช้ล่าสุด")}</th>
                  <th className="px-2 py-2 text-right font-medium" title={t("เข้าสู่ระบบ")}>
                    {t("เข้า")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium">{t("นับ")}</th>
                  <th className="px-2 py-2 text-right font-medium" title={t("ส่งยอดนับ")}>
                    {t("ส่ง")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium" title={t("รับ / เบิก / โอน / เสีย")}>
                    {t("ใบรับ-เบิก")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium" title={t("เสนอรายการใหม่")}>
                    {t("เสนอ")}
                  </th>
                  <th className="px-4 py-2 text-right font-medium" title={t("อนุมัติ / สั่งนับซ้ำ / แก้ยอด")}>
                    {t("ตรวจ")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...active, ...idle].map((x) => {
                  const on = activeOn(x);
                  return (
                    <tr key={x.id} className={`border-t border-line ${on ? "" : "text-muted"}`}>
                      <td className="px-4 py-2">
                        <b className={on ? "" : "font-medium"}>{x.name}</b>
                        <span className="block text-xs text-muted">
                          {t(ROLE_LABEL[x.role])} · {x.login}
                          {x.device && ` · ${x.device}`}
                        </span>
                        {x.lockedUntil && (
                          <span className="pill mt-1 bg-bad-soft text-bad">
                            {t("ล็อกถึง {time}", { time: fmtTime(x.lockedUntil, lang) })}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {x.online && date === today ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-ok">
                            <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
                            {t("ออนไลน์")}
                          </span>
                        ) : x.lastActiveAt ? (
                          <span>
                            {+new Date(x.lastActiveAt) >= t0 && +new Date(x.lastActiveAt) < t0 + 86_400_000
                              ? fmtTime(x.lastActiveAt, lang)
                              : fmtDateTime(x.lastActiveAt, lang)}
                          </span>
                        ) : (
                          <span className="text-muted">{t("ยังไม่เคยเข้า")}</span>
                        )}
                      </td>
                      <Num n={x.logins} bad={x.failed} t={t} />
                      <Num n={x.lines} />
                      <Num n={x.submits} />
                      <Num n={x.movements} />
                      <Num n={x.proposals} />
                      <Num n={x.reviews} last />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {idle.length > 0 && (
            <p className="border-t border-line px-4 py-3 text-sm text-muted">
              {t("ไม่ได้ใช้งาน {n} คน", { n: idle.length })}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, note, bad }: { label: string; value: number | string; note?: string; bad?: boolean }) {
  return (
    <div className="card p-4">
      <span className="text-sm text-muted">{label}</span>
      <b className="num block text-2xl">{value}</b>
      {note && <span className={`text-xs ${bad ? "text-bad" : "text-muted"}`}>{note}</span>}
    </div>
  );
}

function Num({ n, bad, t, last }: { n: number; bad?: number; t?: TFn; last?: boolean }) {
  return (
    <td className={`num py-2 text-right ${last ? "px-4" : "px-2"}`}>
      {n || <span className="text-muted">–</span>}
      {!!bad && t && (
        <span className="block font-sans text-xs text-bad" title={t("เข้าสู่ระบบไม่สำเร็จ")}>
          {t("ผิด {n}", { n: bad })}
        </span>
      )}
    </td>
  );
}

const hourLabel = (i: number) => String((i + 6) % 24).padStart(2, "0");

/** One bar per hour of the business day, 06:00 → 05:00. */
function HourChart({ hours, t }: { hours: number[]; t: TFn }) {
  const max = Math.max(...hours);
  const peak = hours.indexOf(max);
  return (
    <section className="card p-4" aria-labelledby="hour-h">
      <h2 id="hour-h" className="font-semibold">
        {t("กิจกรรมรายชั่วโมง")}
      </h2>
      <p className="mb-3 text-sm text-muted">
        {max > 0
          ? t("มากสุดช่วง {from}:00–{to}:00 · {n} ครั้ง", { from: hourLabel(peak), to: hourLabel(peak + 1), n: max })
          : t("ยังไม่มีการใช้งาน")}
      </p>
      <div className="flex h-32 items-end gap-[2px] border-b border-line" role="list">
        {hours.map((n, i) => (
          <div
            key={i}
            role="listitem"
            className="group relative flex h-full flex-1 items-end"
            title={`${hourLabel(i)}:00–${hourLabel(i + 1)}:00 · ${t("{n} ครั้ง", { n })}`}
            aria-label={`${hourLabel(i)}:00 ${t("{n} ครั้ง", { n })}`}
          >
            {n > 0 && (
              <div
                className={`w-full rounded-t-[4px] ${i === peak ? "bg-accent" : "bg-accent/60"} group-hover:bg-accent`}
                style={{ height: `${Math.max(4, (n / max) * 100)}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="num mt-1 flex text-xs text-muted" aria-hidden>
        {hours.map((_, i) => (
          <span key={i} className="flex-1 text-left">
            {i % 3 === 0 ? hourLabel(i) : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t("นับรวม: เข้าสู่ระบบ, บันทึกยอดนับ, ส่ง/อนุมัติ, รับ-เบิก-โอน-เสีย, เสนอรายการ")}</p>
    </section>
  );
}
