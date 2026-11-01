import { requireUser } from "@/lib/session";
import { reportRows, stockAlerts } from "@/lib/stock";
import { fmtRange } from "@/lib/dates";
import { can } from "@/lib/types";
import { IconDownload } from "@/components/icons";
import { getT } from "@/i18n/server";
import { ConsoleHeader, RangeTabs, rangeOf } from "../parts";
import { StockTable } from "./stock-table";

export default async function ConsoleStockPage({ searchParams }: PageProps<"/admin/stock">) {
  const user = await requireUser(can.console);
  const { t, lang } = await getT();
  const { range, from, to } = rangeOf((await searchParams).range);
  const [rows, alerts] = await Promise.all([reportRows(user, from, to), stockAlerts(user)]);
  const level = new Map(alerts.map((a) => [a.itemId, a.level]));
  const q = `from=${from}&to=${to}`;

  return (
    <main className="mx-auto max-w-7xl px-4 pt-5 lg:px-8 lg:pt-8">
      <ConsoleHeader
        eyebrow={`MAI The Sky Bar · ${fmtRange(from, to, lang)}`}
        title={t("รายงานสต็อก")}
        right={
          <>
            <RangeTabs path="/admin/stock" range={range} t={t} />
            <a href={`/api/reports/export?${q}`} className="btn min-h-10 px-3 text-sm" download>
              <IconDownload width={16} height={16} /> Excel
            </a>
            <a href={`/report?${q}`} className="btn min-h-10 px-3 text-sm">
              <IconDownload width={16} height={16} /> PDF
            </a>
          </>
        }
      />
      <StockTable rows={rows.map((r) => ({ ...r, level: level.get(r.itemId) ?? null }))} />
    </main>
  );
}
