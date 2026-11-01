import { requireUser } from "@/lib/session";
import { listMovements } from "@/lib/movements";
import { businessDate, fmtTime, fmtWeekday } from "@/lib/dates";
import { KIND_LABEL, wasteReasonLabel } from "@/lib/movement-types";
import { PageHeader, fmtQty } from "@/components/status";
import { VoidButton } from "./void-button";
import { getT } from "@/i18n/server";

const KIND_STYLE = {
  receive: "bg-ok-soft text-ok",
  issue: "bg-sky-soft text-sky",
  transfer: "bg-accent-soft text-accent",
  waste: "bg-bad-soft text-bad",
} as const;

export default async function MovementsPage() {
  const user = await requireUser();
  const list = await listMovements(user, 7);
  const { t, lang } = await getT();
  const dayOf = (d: Date) => businessDate(new Date(d));
  const days = [...new Set(list.map((m) => dayOf(m.recordedAt)))];

  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow={t("7 วันล่าสุด")} title={t("รับ · เบิก · โอน · ของเสีย")} />
      {list.length === 0 && <p className="card p-5 text-muted">{t("ยังไม่มีรายการ")}</p>}
      {days.map((day) => (
        <section key={day} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-muted">{fmtWeekday(day, lang)}</h2>
          <ul className="grid gap-2">
            {list
              .filter((m) => dayOf(m.recordedAt) === day)
              .map((m) => (
                <li key={m.id} className={`card p-4 ${m.voidedAt ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`pill ${KIND_STYLE[m.kind]}`}>{t(KIND_LABEL[m.kind])}</span>
                      <p className="mt-1 text-sm text-muted">
                        {fmtTime(m.recordedAt, lang)} · {m.createdBy}
                        {m.kind === "transfer" ? ` · ${m.fromName} → ${m.toName}` : ` · ${m.fromName ?? m.toName}`}
                        {m.supplier && ` · ${m.supplier}`}
                        {m.reason && ` · ${wasteReasonLabel(m.reason) ? t(wasteReasonLabel(m.reason)!) : m.reason}`}
                      </p>
                    </div>
                    {m.photoKey && (
                      <a href={`/api/files/${m.photoKey}`} target="_blank" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated file route */}
                        <img src={`/api/files/${m.photoKey}`} alt={t("รูปที่แนบ")} className="h-14 w-14 rounded-lg border border-line object-cover" />
                      </a>
                    )}
                  </div>
                  <ul className={`mt-2 text-sm ${m.voidedAt ? "line-through" : ""}`}>
                    {m.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{l.name}</span>
                        <span className="num">
                          {fmtQty(l.qty)} {l.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {m.note && <p className="mt-1 text-sm text-muted">{t("หมายเหตุ: {note}", { note: m.note })}</p>}
                  {m.voidedAt ? (
                    <p className="mt-2 text-sm font-semibold text-bad">{t("ยกเลิกแล้ว")} · {m.voidReason}</p>
                  ) : (
                    m.canVoid && <VoidButton id={m.id} />
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
