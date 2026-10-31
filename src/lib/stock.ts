import "server-only";
import { getDb, type Db } from "./db";
import { sheetProposals } from "./proposal-sheet";
import { tk } from "@/i18n";
import { HttpError, type User } from "./session";
import { addDays, businessDate, daysBetween } from "./dates";
import {
  round2,
  type CountStatus,
  type LineInput,
  type LineStatus,
  type Sheet,
  type SheetLine,
  type StockAlert,
} from "./types";

const MAX_QTY = 1_000_000;

export async function audit(
  db: Db,
  userId: number,
  action: string,
  entity: string,
  entityId: string | number,
  before: unknown,
  after: unknown,
  note?: string,
) {
  await db.query(
    `insert into audit_log (user_id, action, entity, entity_id, before, after, note) values ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, action, entity, String(entityId), before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after), note ?? null],
  );
}

async function categoryPaths(db: Db, outletId: number): Promise<Map<number, string[]>> {
  const rows = await db.query<{ id: number; parent_id: number | null; name: string }>(
    `select id, parent_id, name from categories where outlet_id = $1`,
    [outletId],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const paths = new Map<number, string[]>();
  for (const r of rows) {
    const path: string[] = [];
    for (let c: typeof r | undefined = r; c; c = c.parent_id ? byId.get(c.parent_id) : undefined) path.unshift(c.name);
    paths.set(r.id, path);
  }
  return paths;
}

interface CountRow {
  id: number;
  location_id: number;
  location_name: string;
  outlet_id: number;
  business_date: string;
  status: CountStatus;
  submitted_by: number | null;
  submitted_by_name: string | null;
  submitted_at: Date | null;
}

async function getCount(db: Db, user: User, countId: number): Promise<CountRow> {
  const [c] = await db.query<CountRow>(
    `select c.*, loc.name as location_name, loc.outlet_id, u.name as submitted_by_name
     from counts c join locations loc on loc.id = c.location_id
     left join users u on u.id = c.submitted_by
     where c.id = $1`,
    [countId],
  );
  if (!c || c.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบรอบนับนี้");
  return c;
}

// Latest counted quantity per item from earlier, non-draft counts = ยกมา ($1 location, $2 business date)
export const OPENING_SQL = `
  select distinct on (l.item_id) l.item_id, l.counted
  from count_lines l join counts c on c.id = l.count_id
  join items i on i.id = l.item_id
  where i.location_id = $1 and c.business_date < $2 and c.status <> 'draft' and l.counted is not null
  order by l.item_id, c.business_date desc`;

/** Movements recorded while no draft was open (or after the item was already
 * counted) feed the next count: attach them to this draft's uncounted lines. */
export async function attachPendingMoves(tx: Db, countId: number, locationId: number) {
  const attached = await tx.query(
    `update movement_lines ml set count_id = $1
     from movements m, items i, count_lines cl
     where ml.movement_id = m.id and m.voided_at is null and ml.count_id is null
       and i.id = ml.item_id and i.location_id = $2
       and cl.count_id = $1 and cl.item_id = ml.item_id and cl.counted is null
     returning ml.id`,
    [countId, locationId],
  );
  if (attached.length) await refreshMoves(tx, countId);
}

/** Recompute mv_in / mv_out of a count from its (non-voided) movement lines. */
export async function refreshMoves(tx: Db, countId: number) {
  await tx.query(
    `update count_lines cl set
       mv_in = coalesce((select sum(ml.qty) from movement_lines ml join movements m on m.id = ml.movement_id
                         where ml.count_id = cl.count_id and ml.item_id = cl.item_id and ml.direction = 'in' and m.voided_at is null), 0),
       mv_out = coalesce((select sum(ml.qty) from movement_lines ml join movements m on m.id = ml.movement_id
                          where ml.count_id = cl.count_id and ml.item_id = cl.item_id and ml.direction = 'out' and m.voided_at is null), 0)
     where cl.count_id = $1`,
    [countId],
  );
}

/** Get today's count sheet for a location, creating the count and its lines if needed. */
export async function getSheet(user: User, locationId: number): Promise<Sheet> {
  const db = await getDb();
  const date = businessDate();
  const [loc] = await db.query<{ id: number; name: string; outlet_id: number }>(
    `select id, name, outlet_id from locations where id = $1 and active`,
    [locationId],
  );
  if (!loc || loc.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบจุดเก็บนี้");

  const countId = await db.tx(async (tx) => {
    await tx.query(
      `insert into counts (location_id, business_date) values ($1,$2) on conflict (location_id, business_date) do nothing`,
      [locationId, date],
    );
    const [c] = await tx.query<{ id: number; status: CountStatus }>(
      `select id, status from counts where location_id = $1 and business_date = $2`,
      [locationId, date],
    );
    if (c.status === "draft") {
      await tx.query(
        `insert into count_lines (count_id, item_id, opening)
         select $3, i.id, o.counted from items i left join (${OPENING_SQL}) o on o.item_id = i.id
         where i.location_id = $1 and i.active
         on conflict do nothing`,
        [locationId, date, c.id],
      );
      // Items deactivated or moved to another location since the draft was opened leave the sheet.
      await tx.query(
        `delete from count_lines l using items i
         where l.count_id = $2 and i.id = l.item_id and (not i.active or i.location_id <> $1)`,
        [locationId, c.id],
      );
      // Yesterday's count may have been approved/adjusted since this draft was opened.
      await tx.query(
        `update count_lines l set opening = o.counted from (${OPENING_SQL}) o
         where l.count_id = $3 and l.item_id = o.item_id and l.opening is distinct from o.counted`,
        [locationId, date, c.id],
      );
      await attachPendingMoves(tx, c.id, locationId);
    }
    return c.id;
  });
  return loadSheet(db, user, countId);
}

async function loadSheet(db: Db, user: User, countId: number): Promise<Sheet> {
  const c = await getCount(db, user, countId);
  const paths = await categoryPaths(db, user.outletId);
  const rows = await db.query<{
    item_id: number;
    name_th: string;
    name_en: string;
    unit: string;
    par: number;
    blind: boolean;
    category_id: number | null;
    opening: number | null;
    in_qty: number;
    out_qty: number;
    mv_in: number;
    mv_out: number;
    counted: number | null;
    status: LineStatus;
  }>(
    `select l.item_id, i.name_th, i.name_en, i.unit, i.par, i.blind, i.category_id,
            l.opening, l.in_qty, l.out_qty, l.mv_in, l.mv_out, l.counted, l.status
     from count_lines l join items i on i.id = l.item_id
     where l.count_id = $1 order by i.sort_order, i.id`,
    [countId],
  );
  const lines: SheetLine[] = rows.map((r) => ({
    itemId: r.item_id,
    nameTh: r.name_th,
    nameEn: r.name_en,
    unit: r.unit,
    par: r.par,
    blind: r.blind,
    path: r.category_id ? (paths.get(r.category_id) ?? []) : [],
    // Blind count: never send the system figure to the counter's device.
    opening: r.blind ? null : r.opening,
    inQty: r.in_qty,
    outQty: r.out_qty,
    mvIn: r.mv_in,
    mvOut: r.mv_out,
    counted: r.counted,
    status: r.status,
    editable: c.status === "draft" || (c.status === "recount" && r.status === "recount"),
  }));
  return {
    countId: c.id,
    locationId: c.location_id,
    locationName: c.location_name,
    businessDate: c.business_date,
    status: c.status,
    lines,
    proposals: await sheetProposals(db, c.location_id, c.business_date),
    fetchedAt: Date.now(),
  };
}

function cleanQty(n: unknown, field: string): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > MAX_QTY) {
    throw new HttpError(400, "ค่า {field} ไม่ถูกต้อง", { field });
  }
  return round2(n);
}

/** Apply line edits from the device. Lines that are no longer editable are skipped. */
export async function saveLines(
  user: User,
  countId: number,
  inputs: LineInput[],
): Promise<{ sheet: Sheet; rejected: number[] }> {
  const db = await getDb();
  const rejected: number[] = [];
  await db.tx(async (tx) => {
    const c = await getCount(tx, user, countId);
    for (const input of inputs) {
      const itemId = Number(input.itemId);
      const inQty = cleanQty(input.inQty, tk("รับเข้า"));
      const outQty = cleanQty(input.outQty, tk("เบิกออก"));
      const counted = input.counted === null ? null : cleanQty(input.counted, tk("คงเหลือ"));
      const [line] = await tx.query<{ status: LineStatus; in_qty: number; out_qty: number; counted: number | null }>(
        `select status, in_qty, out_qty, counted from count_lines where count_id = $1 and item_id = $2 for update`,
        [countId, itemId],
      );
      const editable = line && (c.status === "draft" || (c.status === "recount" && line.status === "recount"));
      if (!editable) {
        rejected.push(itemId);
        continue;
      }
      if (line.in_qty === inQty && line.out_qty === outQty && line.counted === counted) continue;
      await tx.query(
        `update count_lines set in_qty = $3, out_qty = $4, counted = $5, counted_by = $6, updated_at = now()
         where count_id = $1 and item_id = $2`,
        [countId, itemId, inQty, outQty, counted, user.id],
      );
      if (c.status === "recount") {
        await audit(tx, user.id, "line.recount_edit", "count_line", `${countId}:${itemId}`,
          { in: line.in_qty, out: line.out_qty, counted: line.counted }, { in: inQty, out: outQty, counted });
      }
    }
  });
  return { sheet: await loadSheet(db, user, countId), rejected };
}

/** ส่งยอดนับให้หัวหน้าตรวจ */
export async function submitCount(user: User, countId: number): Promise<Sheet> {
  const db = await getDb();
  await db.tx(async (tx) => {
    const c = await getCount(tx, user, countId);
    if (c.status !== "draft" && c.status !== "recount") {
      throw new HttpError(409, "รอบนับนี้ส่งไปแล้ว");
    }
    const scope = c.status === "draft" ? `true` : `status = 'recount'`;
    const [{ missing }] = await tx.query<{ missing: number }>(
      `select count(*) as missing from count_lines where count_id = $1 and ${scope} and counted is null`,
      [countId],
    );
    if (missing > 0) throw new HttpError(409, "ยังนับไม่ครบ เหลืออีก {n} รายการ", { n: missing });
    await tx.query(
      `update count_lines set status = case when expected is null or counted = expected then 'ok' else 'flag' end
       where count_id = $1 and ${scope}`,
      [countId],
    );
    await tx.query(
      `update counts set status = 'submitted', submitted_by = $2, submitted_at = now() where id = $1`,
      [countId, user.id],
    );
    const [{ flagged }] = await tx.query<{ flagged: number }>(
      `select count(*) as flagged from count_lines where count_id = $1 and status = 'flag'`,
      [countId],
    );
    await audit(tx, user.id, c.status === "draft" ? "count.submit" : "count.resubmit", "count", countId,
      { status: c.status }, { status: "submitted", flagged });
  });
  return loadSheet(db, user, countId);
}

// ---------------------------------------------------------------- review

export interface ReviewLine {
  itemId: number;
  name: string;
  nameTh: string;
  unit: string;
  blind: boolean;
  opening: number | null;
  inQty: number; // total in = recorded movements + typed on the sheet
  outQty: number;
  mvIn: number;
  mvOut: number;
  expected: number | null;
  counted: number | null;
  variance: number | null;
  status: LineStatus;
  /** Thai key: render with t(hint) */
  hint: string | null;
}

export interface Review {
  countId: number;
  locationName: string;
  businessDate: string;
  status: CountStatus;
  submittedBy: string | null;
  submittedAt: Date | null;
  lines: ReviewLine[];
}

function varianceHint(l: { variance: number | null; inQty: number; outQty: number }): string | null {
  if (!l.variance) return null;
  if (l.variance < 0 && l.outQty === 0) return tk("ไม่มีบันทึกเบิกออกหรือของเสียในรอบนี้");
  if (l.variance > 0 && l.inQty === 0) return tk("ไม่มีบันทึกรับเข้าในรอบนี้");
  return null;
}

export async function getReview(user: User, countId: number): Promise<Review> {
  const db = await getDb();
  const c = await getCount(db, user, countId);
  const rows = await db.query<{
    item_id: number;
    name_th: string;
    name_en: string;
    unit: string;
    blind: boolean;
    opening: number | null;
    in_qty: number;
    out_qty: number;
    mv_in: number;
    mv_out: number;
    expected: number | null;
    counted: number | null;
    status: LineStatus;
  }>(
    `select l.item_id, i.name_th, i.name_en, i.unit, i.blind, l.opening, l.in_qty + l.mv_in as in_qty,
            l.out_qty + l.mv_out as out_qty, l.mv_in, l.mv_out, l.expected, l.counted, l.status
     from count_lines l join items i on i.id = l.item_id where l.count_id = $1 order by i.sort_order, i.id`,
    [countId],
  );
  return {
    countId: c.id,
    locationName: c.location_name,
    businessDate: c.business_date,
    status: c.status,
    submittedBy: c.submitted_by_name,
    submittedAt: c.submitted_at,
    lines: rows.map((r) => {
      const variance = r.expected === null || r.counted === null ? null : round2(r.counted - r.expected);
      const base = { variance, inQty: r.in_qty, outQty: r.out_qty };
      return {
        itemId: r.item_id,
        name: r.name_en || r.name_th,
        nameTh: r.name_th,
        unit: r.unit,
        blind: r.blind,
        opening: r.opening,
        inQty: r.in_qty,
        outQty: r.out_qty,
        mvIn: r.mv_in,
        mvOut: r.mv_out,
        expected: r.expected,
        counted: r.counted,
        variance,
        status: r.status,
        hint: varianceHint(base),
      };
    }),
  };
}

async function finalizeIfDone(tx: Db, user: User, countId: number) {
  const [{ open }] = await tx.query<{ open: number }>(
    `select count(*) as open from count_lines where count_id = $1 and status <> 'confirmed'`,
    [countId],
  );
  if (open === 0) {
    const updated = await tx.query(
      `update counts set status = 'approved', approved_by = $2, approved_at = now()
       where id = $1 and status = 'submitted' returning id`,
      [countId, user.id],
    );
    if (updated.length) await audit(tx, user.id, "count.approve", "count", countId, null, { status: "approved" });
  }
}

async function reviewableCount(tx: Db, user: User, countId: number) {
  const c = await getCount(tx, user, countId);
  if (c.status !== "submitted" && c.status !== "recount") throw new HttpError(409, "รอบนับนี้ไม่อยู่ในสถานะรอตรวจ");
  return c;
}

/** หัวหน้ายืนยันยอดของรายการที่ต่าง */
export async function confirmLine(user: User, countId: number, itemId: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    await reviewableCount(tx, user, countId);
    const r = await tx.query(
      `update count_lines set status = 'confirmed' where count_id = $1 and item_id = $2 and status = 'flag' returning item_id`,
      [countId, itemId],
    );
    if (r.length) await audit(tx, user.id, "line.confirm", "count_line", `${countId}:${itemId}`, { status: "flag" }, { status: "confirmed" });
    await finalizeIfDone(tx, user, countId);
  });
}

/** หัวหน้าสั่งนับซ้ำ: ส่งรายการกลับไปให้คนนับทันที */
export async function requestRecount(user: User, countId: number, itemId: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    await reviewableCount(tx, user, countId);
    const r = await tx.query(
      `update count_lines set status = 'recount' where count_id = $1 and item_id = $2 and status in ('flag','ok') returning item_id`,
      [countId, itemId],
    );
    if (!r.length) return;
    await tx.query(`update counts set status = 'recount' where id = $1`, [countId]);
    await audit(tx, user.id, "line.request_recount", "count_line", `${countId}:${itemId}`, null, { status: "recount" });
  });
}

/** หัวหน้าแก้ยอดเองพร้อมเหตุผล (บันทึก Audit log) */
export async function adjustLine(user: User, countId: number, itemId: number, counted: number, reason: string) {
  const qty = cleanQty(counted, tk("คงเหลือ"));
  if (!reason.trim()) throw new HttpError(400, "กรุณาระบุเหตุผลที่แก้ยอด");
  const db = await getDb();
  await db.tx(async (tx) => {
    await reviewableCount(tx, user, countId);
    const [line] = await tx.query<{ counted: number | null; status: LineStatus }>(
      `select counted, status from count_lines where count_id = $1 and item_id = $2 for update`,
      [countId, itemId],
    );
    if (!line) throw new HttpError(404, "ไม่พบรายการนี้");
    await tx.query(
      `update count_lines set counted = $3, status = 'confirmed', updated_at = now() where count_id = $1 and item_id = $2`,
      [countId, itemId, qty],
    );
    await audit(tx, user.id, "line.adjust", "count_line", `${countId}:${itemId}`,
      { counted: line.counted, status: line.status }, { counted: qty, status: "confirmed" }, reason.trim());
    await finalizeIfDone(tx, user, countId);
  });
}

/** อนุมัติทุกรายการที่ตรงกัน */
export async function approveMatched(user: User, countId: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    await reviewableCount(tx, user, countId);
    const r = await tx.query(
      `update count_lines set status = 'confirmed' where count_id = $1 and status = 'ok' returning item_id`,
      [countId],
    );
    if (r.length) await audit(tx, user.id, "count.approve_matched", "count", countId, null, { lines: r.length });
    await finalizeIfDone(tx, user, countId);
  });
}

export interface QueueItem {
  countId: number;
  locationName: string;
  businessDate: string;
  status: CountStatus;
  submittedBy: string | null;
  submittedAt: Date | null;
  total: number;
  flagged: number;
  recount: number;
}

export async function reviewQueue(user: User): Promise<{ pending: QueueItem[]; recent: QueueItem[] }> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    location_name: string;
    business_date: string;
    status: CountStatus;
    submitted_by_name: string | null;
    submitted_at: Date | null;
    total: number;
    flagged: number;
    recount: number;
  }>(
    `select c.id, loc.name as location_name, c.business_date, c.status, u.name as submitted_by_name, c.submitted_at,
            count(l.item_id) as total,
            count(l.item_id) filter (where l.status = 'flag') as flagged,
            count(l.item_id) filter (where l.status = 'recount') as recount
     from counts c join locations loc on loc.id = c.location_id
     left join users u on u.id = c.submitted_by
     left join count_lines l on l.count_id = c.id
     where loc.outlet_id = $1 and c.status <> 'draft' and c.business_date >= $2
     group by c.id, loc.name, loc.sort_order, u.name
     order by c.business_date desc, loc.sort_order`,
    [user.outletId, addDays(businessDate(), -14)],
  );
  const items = rows.map((r) => ({
    countId: r.id,
    locationName: r.location_name,
    businessDate: r.business_date,
    status: r.status,
    submittedBy: r.submitted_by_name,
    submittedAt: r.submitted_at,
    total: r.total,
    flagged: r.flagged,
    recount: r.recount,
  }));
  return {
    pending: items.filter((i) => i.status === "submitted" || i.status === "recount"),
    recent: items.filter((i) => i.status === "approved").slice(0, 10),
  };
}

// ---------------------------------------------------------------- home + alerts

export interface LocationTask {
  locationId: number;
  locationName: string;
  dueTime: string;
  items: number;
  countId: number | null;
  status: CountStatus | null;
  counted: number;
  recount: number;
}

export async function todayTasks(user: User, date = businessDate()): Promise<LocationTask[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    name: string;
    due_time: string;
    items: number;
    count_id: number | null;
    status: CountStatus | null;
    counted: number | null;
    recount: number | null;
  }>(
    `select loc.id, loc.name, to_char(loc.due_time, 'HH24:MI') as due_time,
            (select count(*) from items i where i.location_id = loc.id and i.active) as items,
            c.id as count_id, c.status,
            (select count(*) from count_lines l where l.count_id = c.id and l.counted is not null) as counted,
            (select count(*) from count_lines l where l.count_id = c.id and l.status = 'recount') as recount
     from locations loc
     left join counts c on c.location_id = loc.id and c.business_date = $2
     where loc.outlet_id = $1 and loc.active
     order by loc.sort_order`,
    [user.outletId, date],
  );
  return rows
    .filter((r) => r.items > 0)
    .map((r) => ({
      locationId: r.id,
      locationName: r.name,
      dueTime: r.due_time,
      items: r.items,
      countId: r.count_id,
      status: r.status,
      counted: r.counted ?? 0,
      recount: r.recount ?? 0,
    }));
}

/** รายการที่หมดหรือต่ำกว่า Par จากยอดนับล่าสุดของแต่ละรายการ */
export async function stockAlerts(user: User): Promise<StockAlert[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    name_th: string;
    name_en: string;
    unit: string;
    par: number;
    counted: number;
    location_name: string;
  }>(
    `select * from (
       select distinct on (i.id) i.id, i.name_th, i.name_en, i.unit, i.par, l.counted, loc.name as location_name, i.sort_order
       from items i join locations loc on loc.id = i.location_id
       join count_lines l on l.item_id = i.id join counts c on c.id = l.count_id
       where i.active and loc.outlet_id = $1 and l.counted is not null
       order by i.id, c.business_date desc
     ) latest where counted <= 0 or counted < par
     order by counted > 0, sort_order`,
    [user.outletId],
  );
  return rows.map((r) => ({
    itemId: r.id,
    name: r.name_en || r.name_th,
    unit: r.unit,
    par: r.par,
    counted: r.counted,
    level: r.counted <= 0 ? "out" : "low",
    locationName: r.location_name,
  }));
}

// ---------------------------------------------------------------- dashboard + reports

export interface ReportRow {
  itemId: number;
  name: string;
  nameTh: string;
  unit: string;
  locationId: number;
  locationName: string;
  inSum: number;
  outSum: number;
  closing: number | null;
  variance: number;
  value: number;
}

export async function reportRows(user: User, from: string, to: string): Promise<ReportRow[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    name_th: string;
    name_en: string;
    unit: string;
    unit_cost: number;
    loc_id: number;
    loc_name: string;
    in_sum: number;
    out_sum: number;
    closing: number | null;
    variance: number;
  }>(
    `select i.id, i.name_th, i.name_en, i.unit, i.unit_cost, loc.id as loc_id, loc.name as loc_name,
            sum(l.in_qty + l.mv_in) as in_sum, sum(l.out_qty + l.mv_out) as out_sum,
            (array_agg(l.counted order by c.business_date desc))[1] as closing,
            coalesce(sum(l.counted - l.expected), 0) as variance
     from count_lines l join counts c on c.id = l.count_id
     join items i on i.id = l.item_id join locations loc on loc.id = c.location_id
     where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft'
     group by i.id, loc.id
     order by loc.sort_order, i.sort_order, i.id`,
    [user.outletId, from, to],
  );
  return rows.map((r) => ({
    itemId: r.id,
    name: r.name_en || r.name_th,
    nameTh: r.name_th,
    unit: r.unit,
    locationId: r.loc_id,
    locationName: r.loc_name,
    inSum: r.in_sum,
    outSum: r.out_sum,
    closing: r.closing,
    variance: round2(r.variance),
    value: round2((r.closing ?? 0) * r.unit_cost),
  }));
}

export interface Overview {
  from: string;
  to: string;
  days: number;
  completeDays: number;
  locationNames: string[];
  outOfStock: { name: string; days: number }[];
  variances: { name: string; date: string; locationName: string; variance: number; unit: string; value: number }[];
  inventoryValue: number;
  pendingReview: number;
}

export async function overview(user: User, from: string, to: string): Promise<Overview> {
  const db = await getDb();
  const tasks = await todayTasks(user);
  const days = daysBetween(from, to);

  const done = await db.query<{ business_date: string; n: number }>(
    `select c.business_date, count(*) as n from counts c join locations loc on loc.id = c.location_id
     where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft'
     group by c.business_date`,
    [user.outletId, from, to],
  );
  const doneByDay = new Map(done.map((d) => [d.business_date, d.n]));
  const completeDays = days.filter((d) => (doneByDay.get(d) ?? 0) >= tasks.length).length;

  const outOfStock = await db.query<{ name: string; days: number }>(
    `select coalesce(nullif(i.name_en, ''), i.name_th) as name, count(distinct c.business_date) as days
     from count_lines l join counts c on c.id = l.count_id join items i on i.id = l.item_id
     join locations loc on loc.id = c.location_id
     where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft' and l.counted = 0
     group by i.id order by days desc, name`,
    [user.outletId, from, to],
  );

  const variances = await db.query<{
    name: string;
    business_date: string;
    location_name: string;
    variance: number;
    unit: string;
    value: number;
  }>(
    `select coalesce(nullif(i.name_en, ''), i.name_th) as name, c.business_date, loc.name as location_name,
            l.counted - l.expected as variance, i.unit, (l.counted - l.expected) * i.unit_cost as value
     from count_lines l join counts c on c.id = l.count_id join items i on i.id = l.item_id
     join locations loc on loc.id = c.location_id
     where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft'
       and l.expected is not null and l.counted is not null and l.counted <> l.expected
     order by abs((l.counted - l.expected) * i.unit_cost) desc`,
    [user.outletId, from, to],
  );

  const [{ value }] = await db.query<{ value: number | null }>(
    `select sum(latest.counted * latest.unit_cost) as value from (
       select distinct on (i.id) l.counted, i.unit_cost
       from items i join locations loc on loc.id = i.location_id
       join count_lines l on l.item_id = i.id join counts c on c.id = l.count_id
       where i.active and loc.outlet_id = $1 and c.status <> 'draft' and l.counted is not null and c.business_date <= $2
       order by i.id, c.business_date desc
     ) latest`,
    [user.outletId, to],
  );

  const [{ pending }] = await db.query<{ pending: number }>(
    `select count(*) as pending from counts c join locations loc on loc.id = c.location_id
     where loc.outlet_id = $1 and c.status in ('submitted','recount')`,
    [user.outletId],
  );

  return {
    from,
    to,
    days: days.length,
    completeDays,
    locationNames: tasks.map((t) => t.locationName),
    outOfStock,
    variances: variances.map((v) => ({
      name: v.name,
      date: v.business_date,
      locationName: v.location_name,
      variance: round2(v.variance),
      unit: v.unit,
      value: round2(v.value),
    })),
    inventoryValue: round2(value ?? 0),
    pendingReview: pending,
  };
}

export interface DetailRow {
  date: string;
  locationName: string;
  nameTh: string;
  nameEn: string;
  unit: string;
  opening: number | null;
  inQty: number;
  outQty: number;
  expected: number | null;
  counted: number | null;
  variance: number | null;
  lineStatus: LineStatus;
  countStatus: CountStatus;
  countedBy: string | null;
}

export async function detailRows(user: User, from: string, to: string): Promise<DetailRow[]> {
  const db = await getDb();
  const rows = await db.query<{
    business_date: string;
    location_name: string;
    name_th: string;
    name_en: string;
    unit: string;
    opening: number | null;
    in_qty: number;
    out_qty: number;
    expected: number | null;
    counted: number | null;
    line_status: LineStatus;
    count_status: CountStatus;
    counted_by: string | null;
  }>(
    `select c.business_date, loc.name as location_name, i.name_th, i.name_en, i.unit,
            l.opening, l.in_qty + l.mv_in as in_qty, l.out_qty + l.mv_out as out_qty, l.expected, l.counted, l.status as line_status,
            c.status as count_status, u.name as counted_by
     from count_lines l join counts c on c.id = l.count_id join items i on i.id = l.item_id
     join locations loc on loc.id = c.location_id left join users u on u.id = l.counted_by
     where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft'
     order by c.business_date, loc.sort_order, i.sort_order, i.id`,
    [user.outletId, from, to],
  );
  return rows.map((r) => ({
    date: r.business_date,
    locationName: r.location_name,
    nameTh: r.name_th,
    nameEn: r.name_en,
    unit: r.unit,
    opening: r.opening,
    inQty: r.in_qty,
    outQty: r.out_qty,
    expected: r.expected,
    counted: r.counted,
    variance: r.expected === null || r.counted === null ? null : round2(r.counted - r.expected),
    lineStatus: r.line_status,
    countStatus: r.count_status,
    countedBy: r.counted_by,
  }));
}
