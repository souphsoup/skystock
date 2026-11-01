import { requireUser } from "@/lib/session";
import { costRows } from "@/lib/insights";
import { stockAlerts } from "@/lib/stock";
import { can } from "@/lib/types";
import { getT } from "@/i18n/server";
import { ConsoleHeader } from "../parts";
import { CostGrid } from "./cost-grid";

// Cost and Par for every item in one grid: easier on a computer than item by item on a phone.
export default async function ConsoleItemsPage() {
  const user = await requireUser(can.settings);
  const { t } = await getT();
  const [rows, alerts] = await Promise.all([costRows(user), stockAlerts(user)]);
  const level = new Map(alerts.map((a) => [a.itemId, a.level]));
  return (
    <main className="mx-auto max-w-7xl px-4 pt-5 lg:px-8 lg:pt-8">
      <ConsoleHeader eyebrow={t("ตั้งค่า")} title={t("ราคาทุนและ Par")} />
      <p className="mb-4 max-w-3xl text-muted">
        {t("แก้ได้หลายรายการแล้วกดบันทึกครั้งเดียว ราคาทุนใช้คิดมูลค่าคงคลังและความสูญเสีย Par ใช้แจ้งเตือนของต่ำ ทุกการแก้ไขเก็บในประวัติการแก้ไข")}
      </p>
      <CostGrid rows={rows.map((r) => ({ ...r, level: level.get(r.id) ?? null }))} />
    </main>
  );
}
