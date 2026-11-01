import Link from "next/link";
import { requireUser } from "@/lib/session";
import { insights, type Totals } from "@/lib/insights";
import { overview, stockAlerts } from "@/lib/stock";
import { fmtDay, fmtRange, fmtWeekday } from "@/lib/dates";
import { WASTE_REASONS, wasteReasonLabel } from "@/lib/movement-types";
import { can, type CountStatus } from "@/lib/types";
import { fmtBaht, fmtQty } from "@/components/status";
import { Legend, TimeChart } from "@/components/charts";
import { IconAlert } from "@/components/icons";
import { tk, type TFn } from "@/i18n";
import { getT } from "@/i18n/server";
import { ConsoleHeader, RangeTabs, rangeOf } from "./parts";

// Executive console home: is stock being counted, where is money leaking, what needs a decision.

const LOSS_SERIES = [
  { label: tk("ของขาดจากการนับ"), color: "var(--sky)" },
  { label: tk("ของเสีย"), color: "var(--hl)" },
];

const CELL: Record<CountStatus | "none", { label: string; cls: string }> = {
  approved: { label: tk("อนุมัติแล้ว"), cls: "bg-ok" },
  submitted: { label: tk("รอหัวหน้าตรวจ"), cls: "bg-sky" },
  recount: { label: tk("ต้องนับซ้ำ"), cls: "bg-bad" },
  draft: { label: tk("กำลังนับ"), cls: "bg-accent-soft border border-accent-line" },
  none: { label: tk("ไม่ได้นับ"), cls: "border border-line" },
};

export default async function ConsolePage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser(can.console);
  const { t, lang } = await getT();
  const { range, from, to } = rangeOf((await searchParams).range);
  const [x, ov, alerts] = await Promise.all([insights(user, from, to), overview(user, from, to), stockAlerts(user)]);
  const cur = x.current;
  const prev = x.previous;
  const pct = (tot: Totals) => (tot.expectedDays ? Math.round((tot.countedDays / tot.expectedDays) * 100) : 0);
  const out = alerts.filter((a) => a.level === "out");
  const maxLoc = Math.max(1, ...x.locations.map((l) => l.inventory));
  const wasteTotal = x.wasteByReason.reduce((s, r) => s + r.value, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-5 lg:px-8 lg:pt-8">
      <ConsoleHeader
        eyebrow={`MAI The Sky Bar · ${fmtRange(from, to, lang)}`}
        title={t("ภาพรวมผู้บริหาร")}
        right={<RangeTabs path="/admin" range={range} t={t} />}
      />

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("ตัวเลขสำคัญ")}>
        <Kpi
          label={t("มูลค่าคงคลัง")}
          value={fmtBaht(cur.inventory)}
          note={t("ยอดนับล่าสุด × ราคาทุน")}
          delta={delta(cur.inventory, prev.inventory, "neutral", t)}
        />
        <Kpi
          label={t("ของขาดจากการนับ")}
          value={fmtBaht(cur.shortage)}
          note={cur.surplus ? t("นับเกิน {v}", { v: fmtBaht(cur.surplus) }) : t("นับได้น้อยกว่ายอดที่ควรมี")}
          delta={delta(cur.shortage, prev.shortage, "down", t)}
        />
        <Kpi
          label={t("ของเสีย")}
          value={fmtBaht(cur.waste)}
          note={t("ตามราคาทุน")}
          delta={delta(cur.waste, prev.waste, "down", t)}
        />
        <Kpi
          label={t("นับครบตามกำหนด")}
          value={`${pct(cur)}%`}
          note={t("{a}/{b} จุด-วัน", { a: cur.countedDays, b: cur.expectedDays })}
          delta={points(pct(cur), pct(prev), t)}
        />
      </section>

      <div className="mb-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <section className="card p-5" aria-labelledby="loss">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="loss" className="font-semibold">
                {t("ความสูญเสียรายวัน")}
              </h2>
              <p className="text-sm text-muted">{t("ของขาดจากการนับ + ของเสีย ตามราคาทุน")}</p>
            </div>
            <Legend series={LOSS_SERIES.map((s) => ({ ...s, label: t(s.label) }))} />
          </div>
          <TimeChart
            kind="stack"
            ariaLabel={t("ความสูญเสียรายวัน")}
            series={LOSS_SERIES.map((s) => ({ ...s, label: t(s.label) }))}
            points={x.days.map((d) => ({ label: fmtDay(d.date, lang), values: [d.shortage, d.waste] }))}
          />
        </section>

        <section className="card p-5" aria-labelledby="todo">
          <h2 id="todo" className="mb-3 font-semibold">
            {t("เรื่องที่ต้องตัดสินใจ")}
          </h2>
          <ul className="grid gap-2">
            {ov.pendingReview > 0 && (
              <Issue tone="sky" href="/review" title={t("รอหัวหน้าอนุมัติ {n} รอบนับ", { n: ov.pendingReview })} />
            )}
            {out.length > 0 && (
              <Issue
                tone="bad"
                href="/alerts"
                title={t("ของหมด {n} รายการ", { n: out.length })}
                detail={out
                  .slice(0, 4)
                  .map((a) => a.name)
                  .join(" · ")}
              />
            )}
            {alerts.length - out.length > 0 && (
              <Issue tone="warn" href="/alerts" title={t("ต่ำกว่า Par ต้องสั่ง {n} รายการ", { n: alerts.length - out.length })} />
            )}
            {ov.variances.length > 0 && (
              <Issue
                tone="warn"
                href="/history"
                title={t("ส่วนต่างผิดปกติ {n} รายการ", { n: ov.variances.length })}
                detail={ov.variances
                  .slice(0, 3)
                  .map((v) => `${v.name} ${fmtBaht(v.value)}`)
                  .join(" · ")}
              />
            )}
            {cur.expectedDays > cur.countedDays && (
              <Issue
                tone="warn"
                title={t("ยังไม่ได้นับ {n} จุด-วัน", { n: cur.expectedDays - cur.countedDays })}
                detail={t("ดูตารางการนับด้านล่าง")}
              />
            )}
            {ov.pendingReview === 0 && alerts.length === 0 && ov.variances.length === 0 && cur.expectedDays === cur.countedDays && (
              <li className="text-muted">{t("ไม่มีเรื่องผิดปกติในช่วงนี้")}</li>
            )}
          </ul>
        </section>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5" aria-labelledby="value">
          <h2 id="value" className="font-semibold">
            {t("มูลค่าคงคลังรายวัน")}
          </h2>
          <p className="mb-3 text-sm text-muted">{t("ยอดนับล่าสุดของทุกรายการ × ราคาทุน ณ สิ้นวัน")}</p>
          <TimeChart
            kind="line"
            ariaLabel={t("มูลค่าคงคลังรายวัน")}
            series={[{ label: t("มูลค่าคงคลัง"), color: "var(--accent)" }]}
            points={x.days.map((d) => ({ label: fmtDay(d.date, lang), values: [d.inventory] }))}
          />
        </section>

        <section className="card p-5" aria-labelledby="byloc">
          <h2 id="byloc" className="font-semibold">
            {t("มูลค่าคงคลังตามจุดเก็บ")}
          </h2>
          <p className="mb-4 text-sm text-muted">{t("ณ {day}", { day: fmtDay(to, lang) })}</p>
          <ul className="grid gap-3">
            {x.locations.map((l) => (
              <li key={l.id} className="grid grid-cols-[8rem_1fr_6.5rem] items-center gap-3 text-sm">
                <span className="truncate">{l.name}</span>
                <span className="h-3 rounded-r bg-paper">
                  <span
                    className="block h-3 rounded-r bg-accent"
                    style={{ width: `${(l.inventory / maxLoc) * 100}%` }}
                  />
                </span>
                <b className="num text-right">{fmtBaht(l.inventory)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mb-5 p-5" aria-labelledby="grid">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="grid" className="font-semibold">
              {t("ตารางการนับรายวัน")}
            </h2>
            <p className="text-sm text-muted">{t("แต่ละช่อง = จุดเก็บหนึ่งจุดในหนึ่งวัน ชี้เพื่อดูสถานะ")}</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {(Object.keys(CELL) as (keyof typeof CELL)[]).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className={`inline-block h-3 w-3 rounded-sm ${CELL[k].cls}`} />
                {t(CELL[k].label)}
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <tbody>
              {x.locations.map((l) => (
                <tr key={l.id}>
                  <th scope="row" className="pr-3 text-left font-medium whitespace-nowrap">
                    {l.name}
                  </th>
                  {x.days.map((d) => {
                    const st = x.grid[l.id]?.[d.date] ?? "none";
                    const label = `${l.name} · ${fmtWeekday(d.date, lang)} · ${t(CELL[st].label)}`;
                    return (
                      <td key={d.date} className="p-[2px]">
                        <span
                          title={label}
                          aria-label={label}
                          className={`block rounded-sm ${CELL[st].cls} ${range > 30 ? "h-4 w-2" : "h-6 w-5"}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {x.days.map((d, i) => (
                  <td key={d.date} className="pt-1 text-center text-[11px] text-muted">
                    {range <= 7 || i % 7 === 0 ? fmtDay(d.date, lang).split(" ")[0] : ""}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <section className="card overflow-hidden" aria-labelledby="leaks">
          <div className="px-5 pt-5 pb-3">
            <h2 id="leaks" className="font-semibold">
              {t("รายการที่สูญเสียมากสุด")}
            </h2>
            <p className="text-sm text-muted">{t("เรียงตามมูลค่า ของขาด + ของเสีย")}</p>
          </div>
          {x.losses.length === 0 ? (
            <p className="px-5 pb-5 text-muted">{t("ไม่มีความสูญเสียในช่วงนี้")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted">
                  <tr className="border-t border-line">
                    <th className="px-5 py-2 text-left font-medium">{t("รายการ")}</th>
                    <th className="px-2 py-2 text-left font-medium">{t("จุดเก็บ")}</th>
                    <th className="px-2 py-2 text-right font-medium">{t("ของขาด")}</th>
                    <th className="px-2 py-2 text-right font-medium">{t("ของเสีย")}</th>
                    <th className="px-5 py-2 text-right font-medium">{t("มูลค่ารวม")}</th>
                  </tr>
                </thead>
                <tbody>
                  {x.losses.map((r) => (
                    <tr key={r.itemId} className="border-t border-line">
                      <td className="px-5 py-2">
                        {r.name} <span className="text-muted">({r.unit})</span>
                      </td>
                      <td className="px-2 py-2 text-muted">{r.locationName}</td>
                      <td className="num px-2 py-2 text-right">{r.shortageQty ? fmtQty(r.shortageQty) : "–"}</td>
                      <td className="num px-2 py-2 text-right">{r.wasteQty ? fmtQty(r.wasteQty) : "–"}</td>
                      <td className="num px-5 py-2 text-right font-semibold">
                        {fmtBaht(r.shortageValue + r.wasteValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5" aria-labelledby="reasons">
          <h2 id="reasons" className="font-semibold">
            {t("ของเสียตามสาเหตุ")}
          </h2>
          <p className="mb-4 text-sm text-muted">{t("รวม {v}", { v: fmtBaht(wasteTotal) })}</p>
          {x.wasteByReason.length === 0 ? (
            <p className="text-muted">{t("ไม่มีของเสียในช่วงนี้")}</p>
          ) : (
            <ul className="grid gap-3">
              {x.wasteByReason.map((r) => (
                <li key={r.reason} className="text-sm">
                  <span className="flex justify-between gap-2">
                    <span>{t(wasteReasonLabel(r.reason) ?? WASTE_REASONS.other)}</span>
                    <b className="num">
                      {fmtBaht(r.value)}{" "}
                      <span className="font-normal text-muted">· {Math.round((r.value / wasteTotal) * 100)}%</span>
                    </b>
                  </span>
                  <span className="mt-1 block h-2 rounded-r bg-paper">
                    <span className="block h-2 rounded-r bg-hl" style={{ width: `${(r.value / wasteTotal) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/movements" className="mt-4 inline-block text-sm text-hl">
            {t("ดูรายการรับ · เบิก · โอน · ของเสีย ›")}
          </Link>
        </section>
      </div>
    </main>
  );
}

interface Delta {
  text: string;
  tone: "ok" | "bad" | "muted";
}

/** % change vs the previous range; `better` says which direction is good news. */
function delta(now: number, before: number, better: "up" | "down" | "neutral", t: TFn): Delta | null {
  if (!before) return now ? { text: t("ช่วงก่อนหน้าไม่มีข้อมูล"), tone: "muted" } : null;
  const p = Math.round(((now - before) / before) * 100);
  if (p === 0) return { text: t("เท่ากับช่วงก่อนหน้า"), tone: "muted" };
  const good = better === "neutral" ? null : (p < 0) === (better === "down");
  return {
    text: t("{sign}{p}% จากช่วงก่อนหน้า", { sign: p > 0 ? "▲ +" : "▼ ", p }),
    tone: good === null ? "muted" : good ? "ok" : "bad",
  };
}

function points(now: number, before: number, t: TFn): Delta | null {
  const d = now - before;
  if (d === 0) return { text: t("เท่ากับช่วงก่อนหน้า"), tone: "muted" };
  return { text: t("{sign}{p} จุดจากช่วงก่อนหน้า", { sign: d > 0 ? "▲ +" : "▼ ", p: d }), tone: d > 0 ? "ok" : "bad" };
}

function Kpi({ label, value, note, delta }: { label: string; value: string; note: string; delta: Delta | null }) {
  const tone = { ok: "text-ok", bad: "text-bad", muted: "text-muted" };
  return (
    <div className="card p-5">
      <span className="text-sm text-muted">{label}</span>
      <b className="block text-3xl font-semibold">{value}</b>
      <span className="block text-xs text-muted">{note}</span>
      {delta && <span className={`mt-1 block text-xs font-semibold ${tone[delta.tone]}`}>{delta.text}</span>}
    </div>
  );
}

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
