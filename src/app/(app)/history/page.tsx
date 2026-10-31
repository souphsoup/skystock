import { requireUser } from "@/lib/session";
import { historyUsers, listHistory, type HistoryChange, type HistoryEntry } from "@/lib/history";
import { ACTION_LABEL, HISTORY_DAYS, actionTone, isArea } from "@/lib/history-types";
import { KIND_LABEL, type MoveKind } from "@/lib/movement-types";
import { businessDate, fmtDay, fmtTime, fmtWeekday } from "@/lib/dates";
import { can, ROLE_LABEL, type Role } from "@/lib/types";
import { PageHeader, fmtBaht, fmtQty } from "@/components/status";
import { HistoryFilters } from "./history-filters";
import type { TFn } from "@/i18n";
import { getT } from "@/i18n/server";

const TONE = {
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  sky: "bg-sky-soft text-sky",
} as const;

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const user = await requireUser(can.history);
  const { t, lang } = await getT();
  const sp = await searchParams;
  const days = HISTORY_DAYS.find((d) => String(d) === sp.days) ?? 7;
  const who = Number(sp.who) || null;
  const area = isArea(sp.area) ? sp.area : "all";
  const [list, users] = await Promise.all([listHistory(user, { days, userId: who, area }), historyUsers(user)]);
  const dayOf = (d: Date) => businessDate(new Date(d));
  const groups = [...new Set(list.map((e) => dayOf(e.at)))];

  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow={t("ใครทำอะไร เมื่อไหร่")} title={t("ประวัติการแก้ไข")} />
      <HistoryFilters users={users} />
      {list.length === 0 && <p className="card p-5 text-muted">{t("ยังไม่มีรายการ")}</p>}
      {list.length >= 300 && <p className="mb-3 text-sm text-muted">{t("แสดง 300 รายการล่าสุด เลือกคนหรือเรื่องเพื่อดูให้ละเอียดขึ้น")}</p>}
      {groups.map((day) => (
        <section key={day} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-muted">{fmtWeekday(day, lang)}</h2>
          <ul className="card divide-y divide-line">
            {list
              .filter((e) => dayOf(e.at) === day)
              .map((e) => (
                <li key={e.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`pill ${TONE[actionTone(e.action)]}`}>{actionLabel(e, t)}</span>
                    {e.subject && <b>{e.subject}</b>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {fmtTime(e.at, lang)} · {e.who} ({t(ROLE_LABEL[e.whoRole])})
                    {context(e, t, lang)}
                  </p>
                  {typeof e.detail.items === "string" && <p className="mt-1 text-sm">{e.detail.items}</p>}
                  {e.changes.length > 0 && (
                    <ul className="mt-2 grid gap-0.5 text-sm">
                      {e.changes.map((c) => (
                        <li key={c.field} className="flex flex-wrap gap-x-2">
                          <span className="text-muted">{t(c.field)}</span>
                          <span className="num">
                            <span className="line-through opacity-60">{value(c, c.from, t)}</span>
                            {" → "}
                            <b>{value(c, c.to, t)}</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.note && <p className="mt-1 text-sm">{t("เหตุผล: {note}", { note: e.note })}</p>}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function actionLabel(e: HistoryEntry, t: TFn): string {
  const kind = e.detail.kind as MoveKind | undefined;
  if (e.action === "movement.create" && kind && KIND_LABEL[kind]) return t(KIND_LABEL[kind]);
  if (e.action === "movement.void" && kind && KIND_LABEL[kind]) {
    return `${t(ACTION_LABEL[e.action])} · ${t(KIND_LABEL[kind])}`;
  }
  return ACTION_LABEL[e.action] ? t(ACTION_LABEL[e.action]) : e.action;
}

function context(e: HistoryEntry, t: TFn, lang: "th" | "en"): string {
  const d = e.detail;
  const parts: string[] = [];
  if (typeof d.location === "string") parts.push(d.location);
  if (typeof d.date === "string") parts.push(t("รอบ {date}", { date: fmtDay(d.date, lang) }));
  if (typeof d.flagged === "number" && d.flagged > 0) parts.push(t("ต้องดู {n}", { n: d.flagged }));
  if (typeof d.lines === "number") parts.push(t("{n} รายการ", { n: d.lines }));
  return parts.map((p) => ` · ${p}`).join("");
}

function value(c: HistoryChange, v: unknown, t: TFn): string {
  if (v === null || v === undefined || v === "") return "–";
  if (c.kind === "qty") return fmtQty(Number(v));
  if (c.kind === "baht") return fmtBaht(Number(v));
  if (c.kind === "bool") return v ? t("ใช่") : t("ไม่");
  if (c.kind === "role") return ROLE_LABEL[v as Role] ? t(ROLE_LABEL[v as Role]) : String(v);
  return String(v);
}
