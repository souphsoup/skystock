import ExcelJS from "exceljs";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/session";
import { detailRows, reportRows } from "@/lib/stock";
import { listMovements } from "@/lib/movements";
import { KIND_LABEL, WASTE_REASONS } from "@/lib/movement-types";
import { businessDate, fmtTime, periodRange, type Period } from "@/lib/dates";
import { can } from "@/lib/types";
import { tk } from "@/i18n";
import { getT } from "@/i18n/server";

const LINE_STATUS: Record<string, string> = {
  pending: tk("ยังไม่ส่ง"),
  ok: tk("ตรงกัน"),
  flag: tk("ต้องดู"),
  recount: tk("นับซ้ำ"),
  confirmed: tk("ยืนยันแล้ว"),
};

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser(can.dashboard);
    const { t, lang } = await getT();
    const p = new URL(req.url).searchParams.get("period");
    const period: Period = p === "day" || p === "month" ? p : "week";
    const { from, to } = periodRange(period);
    const [summary, detail, moves] = await Promise.all([
      reportRows(user, from, to),
      detailRows(user, from, to),
      listMovements(user, 45),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "meStock";
    wb.created = new Date();

    const head = (ws: ExcelJS.Worksheet) => {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
    };

    const s = wb.addWorksheet(t("สรุป"));
    s.columns = [
      { header: t("จุดเก็บ"), key: "loc", width: 14 },
      { header: t("รายการ"), key: "name", width: 22 },
      { header: t("ชื่อไทย"), key: "nameTh", width: 20 },
      { header: t("หน่วย"), key: "unit", width: 9 },
      { header: "in", key: "in", width: 9 },
      { header: "out", key: "out", width: 9 },
      { header: "total", key: "total", width: 9 },
      { header: t("ส่วนต่างสะสม"), key: "variance", width: 13 },
      { header: t("มูลค่าคงเหลือ (฿)"), key: "value", width: 16 },
    ];
    for (const r of summary) {
      s.addRow({
        loc: r.locationName,
        name: r.name,
        nameTh: r.nameTh,
        unit: r.unit,
        in: r.inSum,
        out: r.outSum,
        total: r.closing,
        variance: r.variance,
        value: r.value,
      });
    }
    s.getColumn("value").numFmt = "#,##0.00";
    head(s);

    const d = wb.addWorksheet(t("รายวัน"));
    d.columns = [
      { header: t("วันที่"), key: "date", width: 12 },
      { header: t("จุดเก็บ"), key: "loc", width: 14 },
      { header: t("รายการ"), key: "name", width: 22 },
      { header: t("ชื่อไทย"), key: "nameTh", width: 20 },
      { header: t("หน่วย"), key: "unit", width: 9 },
      { header: t("ยกมา"), key: "opening", width: 9 },
      { header: "in", key: "in", width: 9 },
      { header: "out", key: "out", width: 9 },
      { header: t("ควรเหลือ"), key: "expected", width: 10 },
      { header: t("total (นับได้)"), key: "counted", width: 13 },
      { header: t("ส่วนต่าง"), key: "variance", width: 10 },
      { header: t("สถานะ"), key: "status", width: 12 },
      { header: t("คนนับ"), key: "by", width: 12 },
    ];
    for (const r of detail) {
      d.addRow({
        date: r.date,
        loc: r.locationName,
        name: r.nameEn || r.nameTh,
        nameTh: r.nameTh,
        unit: r.unit,
        opening: r.opening,
        in: r.inQty,
        out: r.outQty,
        expected: r.expected,
        counted: r.counted,
        variance: r.variance,
        status: LINE_STATUS[r.lineStatus] ? t(LINE_STATUS[r.lineStatus]) : r.lineStatus,
        by: r.countedBy,
      });
    }
    head(d);

    const mv = wb.addWorksheet(t("รับ-เบิก-โอน-ของเสีย"));
    mv.columns = [
      { header: t("วันที่"), key: "date", width: 12 },
      { header: t("เวลา"), key: "time", width: 8 },
      { header: t("ประเภท"), key: "kind", width: 14 },
      { header: t("จาก"), key: "from", width: 14 },
      { header: t("ไป"), key: "to", width: 14 },
      { header: t("รายการ"), key: "item", width: 22 },
      { header: t("จำนวน"), key: "qty", width: 9 },
      { header: t("หน่วย"), key: "unit", width: 9 },
      { header: t("ซัพพลายเออร์ / สาเหตุ"), key: "why", width: 22 },
      { header: t("หมายเหตุ"), key: "note", width: 24 },
      { header: t("บันทึกโดย"), key: "by", width: 12 },
      { header: t("สถานะ"), key: "status", width: 18 },
    ];
    for (const m of moves) {
      const date = businessDate(new Date(m.recordedAt));
      if (date < from || date > to) continue;
      for (const l of m.lines) {
        mv.addRow({
          date,
          time: fmtTime(m.recordedAt, lang),
          kind: t(KIND_LABEL[m.kind]),
          from: m.fromName,
          to: m.toName,
          item: l.name,
          qty: l.qty,
          unit: l.unit,
          why: m.supplier ?? (m.reason ? (WASTE_REASONS[m.reason] ? t(WASTE_REASONS[m.reason]) : m.reason) : null),
          note: m.note,
          by: m.createdBy,
          status: m.voidedAt ? t("ยกเลิก: {reason}", { reason: m.voidReason ?? "" }) : "",
        });
      }
    }
    head(mv);

    const buf = await wb.xlsx.writeBuffer();
    const filename = `sop-stock_${from}_${to}.xlsx`;
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
