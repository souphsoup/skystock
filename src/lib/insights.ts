import "server-only";
import { getDb } from "./db";
import { HttpError, type User } from "./session";
import { audit } from "./stock";
import { addDays, daysBetween } from "./dates";
import { round2, type CountStatus } from "./types";

// Numbers for the executive console (/admin): one business-date range at a time,
// with the same-length range before it for the "vs previous" deltas.

/** movement recorded_at → business date (06:00 cutoff, see dates.ts) */
const MOVE_DATE = `((m.recorded_at at time zone 'Asia/Bangkok') - interval '6 hours')::date`;

export interface DayPoint {
  date: string;
  /** value counted short of expected (positive baht) */
  shortage: number;
  /** value counted over expected */
  surplus: number;
  waste: number;
  /** stock value at the end of the day: latest count of every active item × unit cost (null before the first count) */
  inventory: number | null;
}

export interface LossItem {
  itemId: number;
  name: string;
  unit: string;
  locationName: string;
  shortageQty: number;
  shortageValue: number;
  wasteQty: number;
  wasteValue: number;
}

export interface LocationSummary {
  id: number;
  name: string;
  items: number;
  inventory: number;
}

export interface Totals {
  shortage: number;
  surplus: number;
  waste: number;
  /** stock value at the end of the range */
  inventory: number;
  /** location-days with a submitted count / location-days expected */
  countedDays: number;
  expectedDays: number;
}

export interface Insights {
  from: string;
  to: string;
  days: DayPoint[];
  current: Totals;
  previous: Totals;
  locations: LocationSummary[];
  /** location id → business date → count status */
  grid: Record<number, Record<string, CountStatus>>;
  losses: LossItem[];
  wasteByReason: { reason: string; value: number }[];
}

export async function insights(user: User, from: string, to: string): Promise<Insights> {
  const db = await getDb();
  const span = daysBetween(from, to).length;
  const prevFrom = addDays(from, -span);
  const o = user.outletId;

  const [locations, counts, variance, waste, values, losses, reasons] = await Promise.all([
    db.query<{ id: number; name: string; items: number }>(
      `select loc.id, loc.name, (select count(*) from items i where i.location_id = loc.id and i.active) as items
       from locations loc where loc.outlet_id = $1 and loc.active order by loc.sort_order`,
      [o],
    ),
    db.query<{ location_id: number; business_date: string; status: CountStatus }>(
      `select c.location_id, c.business_date, c.status from counts c join locations loc on loc.id = c.location_id
       where loc.outlet_id = $1 and c.business_date between $2 and $3`,
      [o, prevFrom, to],
    ),
    db.query<{ d: string; shortage: number; surplus: number }>(
      `select c.business_date as d,
              sum(greatest(l.expected - l.counted, 0) * i.unit_cost) as shortage,
              sum(greatest(l.counted - l.expected, 0) * i.unit_cost) as surplus
       from count_lines l join counts c on c.id = l.count_id join items i on i.id = l.item_id
       join locations loc on loc.id = c.location_id
       where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft'
         and l.expected is not null and l.counted is not null
       group by 1`,
      [o, prevFrom, to],
    ),
    db.query<{ d: string; value: number }>(
      `select ${MOVE_DATE} as d, sum(ml.qty * i.unit_cost) as value
       from movements m join movement_lines ml on ml.movement_id = m.id join items i on i.id = ml.item_id
       where m.outlet_id = $1 and m.kind = 'waste' and m.voided_at is null and ${MOVE_DATE} between $2 and $3
       group by 1`,
      [o, prevFrom, to],
    ),
    // Every count of an active item up to `to`; the stock value per day is carried forward in JS.
    db.query<{ item_id: number; location_id: number; d: string; counted: number; unit_cost: number }>(
      `select l.item_id, i.location_id, c.business_date as d, l.counted, i.unit_cost
       from count_lines l join counts c on c.id = l.count_id join items i on i.id = l.item_id
       join locations loc on loc.id = i.location_id
       where i.active and loc.outlet_id = $1 and c.status <> 'draft' and l.counted is not null and c.business_date <= $2
       order by c.business_date`,
      [o, to],
    ),
    db.query<{
      item_id: number;
      name: string;
      unit: string;
      location_name: string;
      shortage_qty: number;
      shortage_value: number;
      waste_qty: number;
      waste_value: number;
    }>(
      `with short as (
         select l.item_id, sum(l.expected - l.counted) as qty
         from count_lines l join counts c on c.id = l.count_id join locations loc on loc.id = c.location_id
         where loc.outlet_id = $1 and c.business_date between $2 and $3 and c.status <> 'draft'
           and l.expected is not null and l.counted is not null and l.counted < l.expected
         group by 1
       ), waste as (
         select ml.item_id, sum(ml.qty) as qty
         from movements m join movement_lines ml on ml.movement_id = m.id
         where m.outlet_id = $1 and m.kind = 'waste' and m.voided_at is null and ${MOVE_DATE} between $2 and $3
         group by 1
       )
       select i.id as item_id, coalesce(nullif(i.name_en, ''), i.name_th) as name, i.unit, loc.name as location_name,
              coalesce(s.qty, 0) as shortage_qty, coalesce(s.qty, 0) * i.unit_cost as shortage_value,
              coalesce(w.qty, 0) as waste_qty, coalesce(w.qty, 0) * i.unit_cost as waste_value
       from items i join locations loc on loc.id = i.location_id
       left join short s on s.item_id = i.id left join waste w on w.item_id = i.id
       where i.outlet_id = $1 and (s.qty is not null or w.qty is not null)
       order by (coalesce(s.qty, 0) + coalesce(w.qty, 0)) * i.unit_cost desc
       limit 12`,
      [o, from, to],
    ),
    db.query<{ reason: string | null; value: number }>(
      `select m.reason, sum(ml.qty * i.unit_cost) as value
       from movements m join movement_lines ml on ml.movement_id = m.id join items i on i.id = ml.item_id
       where m.outlet_id = $1 and m.kind = 'waste' and m.voided_at is null and ${MOVE_DATE} between $2 and $3
       group by 1 order by 2 desc`,
      [o, from, to],
    ),
  ]);

  // Stock value at the end of each day from prevFrom - 1 to `to`.
  const latest = new Map<number, { loc: number; value: number }>();
  const inventoryAt = new Map<string, number | null>();
  const all = daysBetween(addDays(prevFrom, -1), to);
  let i = 0;
  for (const d of all) {
    for (; i < values.length && values[i].d <= d; i++) {
      const v = values[i];
      latest.set(v.item_id, { loc: v.location_id, value: v.counted * v.unit_cost });
    }
    inventoryAt.set(d, latest.size ? round2([...latest.values()].reduce((s, x) => s + x.value, 0)) : null);
  }
  const inventoryByLoc = new Map<number, number>();
  for (const x of latest.values()) inventoryByLoc.set(x.loc, (inventoryByLoc.get(x.loc) ?? 0) + x.value);

  const varByDay = new Map(variance.map((v) => [v.d, v]));
  const wasteByDay = new Map(waste.map((w) => [w.d, w.value]));
  const point = (date: string): DayPoint => ({
    date,
    shortage: round2(varByDay.get(date)?.shortage ?? 0),
    surplus: round2(varByDay.get(date)?.surplus ?? 0),
    waste: round2(wasteByDay.get(date) ?? 0),
    inventory: inventoryAt.get(date) ?? null,
  });

  const counting = locations.filter((l) => l.items > 0);
  const grid: Insights["grid"] = {};
  for (const c of counts) (grid[c.location_id] ??= {})[c.business_date] = c.status;
  const totals = (a: string, b: string): Totals => {
    const ds = daysBetween(a, b);
    const pts = ds.map(point);
    const sum = (k: "shortage" | "surplus" | "waste") => round2(pts.reduce((s, p) => s + p[k], 0));
    return {
      shortage: sum("shortage"),
      surplus: sum("surplus"),
      waste: sum("waste"),
      inventory: inventoryAt.get(b) ?? 0,
      countedDays: counting.reduce(
        (n, l) => n + ds.filter((d) => grid[l.id]?.[d] && grid[l.id][d] !== "draft").length,
        0,
      ),
      expectedDays: counting.length * ds.length,
    };
  };

  return {
    from,
    to,
    days: daysBetween(from, to).map(point),
    current: totals(from, to),
    previous: totals(prevFrom, addDays(from, -1)),
    locations: counting.map((l) => ({
      id: l.id,
      name: l.name,
      items: l.items,
      inventory: round2(inventoryByLoc.get(l.id) ?? 0),
    })),
    grid,
    losses: losses.map((r) => ({
      itemId: r.item_id,
      name: r.name,
      unit: r.unit,
      locationName: r.location_name,
      shortageQty: round2(r.shortage_qty),
      shortageValue: round2(r.shortage_value),
      wasteQty: round2(r.waste_qty),
      wasteValue: round2(r.waste_value),
    })),
    wasteByReason: reasons.map((r) => ({ reason: r.reason ?? "other", value: round2(r.value) })),
  };
}

// ---------------------------------------------------------------- cost & par grid

export interface CostRow {
  id: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  locationId: number;
  locationName: string;
  unitCost: number;
  par: number;
  active: boolean;
  /** latest submitted count, null if never counted */
  lastCounted: number | null;
}

export async function costRows(user: User): Promise<CostRow[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    name_th: string;
    name_en: string;
    unit: string;
    location_id: number;
    location_name: string;
    unit_cost: number;
    par: number;
    active: boolean;
    last_counted: number | null;
  }>(
    `select i.id, i.name_th, i.name_en, i.unit, i.location_id, loc.name as location_name, i.unit_cost, i.par, i.active,
            (select l.counted from count_lines l join counts c on c.id = l.count_id
             where l.item_id = i.id and l.counted is not null and c.status <> 'draft'
             order by c.business_date desc limit 1) as last_counted
     from items i join locations loc on loc.id = i.location_id
     where i.outlet_id = $1
     order by loc.sort_order, i.sort_order, i.id`,
    [user.outletId],
  );
  return rows.map((r) => ({
    id: r.id,
    nameTh: r.name_th,
    nameEn: r.name_en,
    unit: r.unit,
    locationId: r.location_id,
    locationName: r.location_name,
    unitCost: r.unit_cost,
    par: r.par,
    active: r.active,
    lastCounted: r.last_counted,
  }));
}

export interface CostChange {
  id: number;
  unitCost: number;
  par: number;
}

/** Saves edited cost / Par from the console grid in one transaction, one audit entry per item. */
export async function saveCostPar(user: User, raw: unknown): Promise<number> {
  const list = Array.isArray(raw) ? (raw as CostChange[]) : [];
  if (list.length === 0) throw new HttpError(400, "ยังไม่มีรายการที่แก้");
  if (list.length > 2000) throw new HttpError(400, "เลือกได้ครั้งละไม่เกิน 2,000 รายการ");
  const num = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HttpError(400, "ราคาทุนและ Par ต้องเป็นตัวเลข 0 ขึ้นไป");
    return round2(n);
  };
  const changes = list.map((c) => ({ id: Number(c.id), unitCost: num(c.unitCost), par: num(c.par) }));
  const db = await getDb();
  return db.tx(async (tx) => {
    let n = 0;
    for (const c of changes) {
      const [before] = await tx.query<{ unit_cost: number; par: number }>(
        `select unit_cost, par from items where id = $1 and outlet_id = $2 for update`,
        [c.id, user.outletId],
      );
      if (!before) throw new HttpError(404, "ไม่พบรายการนี้");
      if (before.unit_cost === c.unitCost && before.par === c.par) continue;
      await tx.query(`update items set unit_cost = $2, par = $3 where id = $1`, [c.id, c.unitCost, c.par]);
      await audit(tx, user.id, "item.update", "item", c.id, { unitCost: before.unit_cost, par: before.par }, {
        unitCost: c.unitCost,
        par: c.par,
      });
      n++;
    }
    return n;
  });
}
