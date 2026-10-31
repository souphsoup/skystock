import { requireUser } from "@/lib/session";
import { stockAlerts } from "@/lib/stock";
import { PageHeader, fmtQty } from "@/components/status";
import { getT } from "@/i18n/server";

export default async function AlertsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const alerts = await stockAlerts(user);
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow={t("จากยอดนับล่าสุดของแต่ละรายการ")} title={t("แจ้งเตือน")} />
      {alerts.length === 0 ? (
        <p className="card p-5 text-muted">✓ {t("ทุกรายการยังอยู่เหนือจำนวนขั้นต่ำ (Par)")}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.itemId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <b className="block">{a.name}</b>
                <span className="text-sm text-muted">
                  {a.locationName} · Par {fmtQty(a.par)} {a.unit}
                  {a.par > a.counted && ` · ${t("ควรสั่งอย่างน้อย {qty} {unit}", { qty: fmtQty(a.par - a.counted), unit: a.unit })}`}
                </span>
              </span>
              {a.level === "out" ? (
                <span className="pill bg-bad-soft text-bad">✕ {t("หมดแล้ว")}</span>
              ) : (
                <span className="pill bg-warn-soft text-warn">⚠ {t("เหลือ {n}", { n: fmtQty(a.counted) })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
