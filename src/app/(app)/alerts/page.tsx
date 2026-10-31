import { requireUser } from "@/lib/session";
import { stockAlerts } from "@/lib/stock";
import { PageHeader, fmtQty } from "@/components/status";

export default async function AlertsPage() {
  const user = await requireUser();
  const alerts = await stockAlerts(user);
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow="จากยอดนับล่าสุดของแต่ละรายการ" title="แจ้งเตือน" />
      {alerts.length === 0 ? (
        <p className="card p-5 text-muted">✓ ทุกรายการยังอยู่เหนือจำนวนขั้นต่ำ (Par)</p>
      ) : (
        <ul className="card divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.itemId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <b className="block">{a.name}</b>
                <span className="text-sm text-muted">
                  {a.locationName} · Par {fmtQty(a.par)} {a.unit}
                  {a.par > a.counted && ` · ควรสั่งอย่างน้อย ${fmtQty(a.par - a.counted)} ${a.unit}`}
                </span>
              </span>
              {a.level === "out" ? (
                <span className="pill bg-bad-soft text-bad">✕ หมดแล้ว</span>
              ) : (
                <span className="pill bg-warn-soft text-warn">⚠ เหลือ {fmtQty(a.counted)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
