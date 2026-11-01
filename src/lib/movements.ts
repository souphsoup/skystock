import "server-only";
import { getDb, type Db } from "./db";
import { HttpError, type User } from "./session";
import { audit, refreshMoves } from "./stock";
import { putPhoto } from "./files";
import { businessDate } from "./dates";
import { can, type CountStatus } from "./types";
import { wasteReasonLabel, type MoveInput, type MoveKind } from "./movement-types";
import { tk } from "@/i18n";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: MoveKind[] = ["receive", "issue", "transfer", "waste"];

interface ItemRow {
  id: number;
  location_id: number;
  active: boolean;
  name_th: string;
  name_en: string;
  unit: string;
  unit_cost: number;
  category_id: number | null;
  blind: boolean;
}

const optText = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null;

async function ownLocation(db: Db, user: User, id: unknown, label: string): Promise<number> {
  const n = Number(id);
  const [loc] = await db.query<{ outlet_id: number }>(`select outlet_id from locations where id = $1 and active`, [n]);
  if (!Number.isInteger(n) || !loc || loc.outlet_id !== user.outletId) throw new HttpError(400, "กรุณาเลือก{label}", { label });
  return n;
}

/** Find (or create) the matching item at the destination of a transfer: same Thai name. */
async function destinationItem(tx: Db, user: User, src: ItemRow, toLocationId: number): Promise<number> {
  const [found] = await tx.query<{ id: number; active: boolean }>(
    `select id, active from items where outlet_id = $1 and location_id = $2 and lower(name_th) = lower($3)`,
    [user.outletId, toLocationId, src.name_th],
  );
  if (found) {
    if (!found.active) await tx.query(`update items set active = true where id = $1`, [found.id]);
    return found.id;
  }
  const [r] = await tx.query<{ id: number }>(
    `insert into items (outlet_id, category_id, location_id, name_th, name_en, unit, unit_cost, par, blind, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,0,$8,(select coalesce(max(sort_order), 0) + 1 from items where location_id = $3))
     returning id`,
    [user.outletId, src.category_id, toLocationId, src.name_th, src.name_en, src.unit, src.unit_cost, src.blind],
  );
  await audit(tx, user.id, "item.create", "item", r.id, null, { copiedFrom: src.id, locationId: toLocationId }, "สร้างอัตโนมัติจากการโอน");
  return r.id;
}

/** Feed a movement line into today's draft count if that item has not been counted yet;
 * otherwise it waits for the next count of that location (see attachPendingMoves). */
async function assignLine(tx: Db, lineId: number, itemId: number): Promise<number | null> {
  const [hit] = await tx.query<{ count_id: number }>(
    `select c.id as count_id from items i
     join counts c on c.location_id = i.location_id and c.business_date = $2 and c.status = 'draft'
     join count_lines cl on cl.count_id = c.id and cl.item_id = i.id and cl.counted is null
     where i.id = $1`,
    [itemId, businessDate()],
  );
  if (!hit) return null;
  await tx.query(`update movement_lines set count_id = $2 where id = $1`, [lineId, hit.count_id]);
  return hit.count_id;
}

export async function recordMovement(
  user: User,
  input: MoveInput,
  photo: File | null,
): Promise<{ id: number; duplicate: boolean }> {
  if (typeof input.clientId !== "string" || !UUID.test(input.clientId)) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
  if (!KINDS.includes(input.kind)) throw new HttpError(400, "ประเภทรายการไม่ถูกต้อง");
  const db = await getDb();

  const [dup] = await db.query<{ id: number }>(`select id from movements where client_id = $1`, [input.clientId]);
  if (dup) return { id: dup.id, duplicate: true };

  const locationId = await ownLocation(db, user, input.locationId, tk("จุดเก็บ"));
  const toLocationId = input.kind === "transfer" ? await ownLocation(db, user, input.toLocationId, tk("จุดปลายทาง")) : null;
  if (toLocationId === locationId) throw new HttpError(400, "จุดต้นทางและปลายทางต้องไม่ใช่ที่เดียวกัน");

  const reason = input.kind === "waste" ? String(input.reason ?? "") : null;
  if (reason !== null && !wasteReasonLabel(reason)) throw new HttpError(400, "กรุณาเลือกสาเหตุของเสีย");
  const note = optText(input.note, 300);
  if (reason === "other" && !note) throw new HttpError(400, "กรุณาระบุรายละเอียดสาเหตุ");

  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new HttpError(400, "ยังไม่ได้เลือกรายการ");
  if (input.lines.length > 100) throw new HttpError(400, "รายการเยอะเกินไป แบ่งบันทึกเป็นหลายครั้ง");
  const lines = input.lines.map((l) => {
    const qty = Number(l.qty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1_000_000) throw new HttpError(400, "จำนวนต้องมากกว่า 0");
    return { itemId: Number(l.itemId), qty: Math.round(qty * 100) / 100 };
  });
  if (new Set(lines.map((l) => l.itemId)).size !== lines.length) throw new HttpError(400, "มีรายการซ้ำ");

  const now = Date.now();
  const at = Number(input.recordedAt);
  const recordedAt = new Date(Number.isFinite(at) && at > now - 7 * 86400_000 && at < now + 300_000 ? at : now);

  let photoKey: string | null = null;
  if (photo && photo.size > 0) {
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    photoKey = `outlet-${user.outletId}/${input.kind}/${businessDate().slice(0, 7)}/${input.clientId}.${ext}`;
    await putPhoto(photoKey, photo);
  }

  return db.tx(async (tx) => {
    const items = await tx.query<ItemRow>(
      `select id, location_id, active, name_th, name_en, unit, unit_cost, category_id, blind
       from items where outlet_id = $1 and id = any($2::int[])`,
      [user.outletId, `{${lines.map((l) => l.itemId).join(",")}}`],
    );
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const l of lines) {
      const it = byId.get(l.itemId);
      if (!it || !it.active) throw new HttpError(400, "มีรายการที่ถูกปิดใช้งานหรือไม่พบแล้ว");
      if (it.location_id !== locationId) throw new HttpError(400, "{name} ไม่ได้อยู่ที่จุดเก็บที่เลือก", { name: it.name_th });
    }

    const [m] = await tx.query<{ id: number }>(
      `insert into movements (outlet_id, kind, client_id, supplier, reason, note, photo_key, from_location_id, to_location_id, recorded_at, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (client_id) do nothing returning id`,
      [
        user.outletId,
        input.kind,
        input.clientId,
        input.kind === "receive" ? optText(input.supplier, 80) : null,
        reason,
        note,
        photoKey,
        input.kind === "receive" ? null : locationId,
        input.kind === "receive" ? locationId : toLocationId,
        recordedAt,
        user.id,
      ],
    );
    if (!m) {
      const [again] = await tx.query<{ id: number }>(`select id from movements where client_id = $1`, [input.clientId]);
      return { id: again.id, duplicate: true };
    }

    const effects: { itemId: number; direction: "in" | "out"; qty: number }[] = [];
    for (const l of lines) {
      if (input.kind === "receive") effects.push({ itemId: l.itemId, direction: "in", qty: l.qty });
      else effects.push({ itemId: l.itemId, direction: "out", qty: l.qty });
      if (input.kind === "transfer") {
        const dest = await destinationItem(tx, user, byId.get(l.itemId)!, toLocationId!);
        effects.push({ itemId: dest, direction: "in", qty: l.qty });
      }
    }
    const counts = new Set<number>();
    for (const e of effects) {
      const [row] = await tx.query<{ id: number }>(
        `insert into movement_lines (movement_id, item_id, direction, qty) values ($1,$2,$3,$4) returning id`,
        [m.id, e.itemId, e.direction, e.qty],
      );
      const c = await assignLine(tx, row.id, e.itemId);
      if (c) counts.add(c);
    }
    for (const c of counts) await refreshMoves(tx, c);
    await audit(tx, user.id, "movement.create", "movement", m.id, null, { kind: input.kind, lines, reason, photoKey });
    return { id: m.id, duplicate: false };
  });
}

/** ยกเลิกรายการที่บันทึกผิด ได้เฉพาะก่อนที่รอบนับที่ใช้รายการนี้จะถูกส่ง */
export async function voidMovement(user: User, id: number, rawReason: string) {
  const reason = optText(rawReason, 200);
  if (!reason) throw new HttpError(400, "กรุณาระบุเหตุผลที่ยกเลิก");
  const db = await getDb();
  await db.tx(async (tx) => {
    const [m] = await tx.query<{ outlet_id: number; created_by: number; voided_at: Date | null }>(
      `select outlet_id, created_by, voided_at from movements where id = $1 for update`,
      [id],
    );
    if (!m || m.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบรายการนี้");
    if (m.voided_at) throw new HttpError(409, "รายการนี้ถูกยกเลิกไปแล้ว");
    if (m.created_by !== user.id && !can.review(user.role)) throw new HttpError(403, "ยกเลิกได้เฉพาะคนที่บันทึกหรือหัวหน้า");
    const counts = await tx.query<{ count_id: number; status: CountStatus }>(
      `select distinct ml.count_id, c.status from movement_lines ml join counts c on c.id = ml.count_id where ml.movement_id = $1`,
      [id],
    );
    if (counts.some((c) => c.status !== "draft")) {
      throw new HttpError(409, "รอบนับที่ใช้รายการนี้ส่งไปแล้ว ให้หัวหน้าแก้ยอดที่หน้าตรวจยอดแทน");
    }
    await tx.query(`update movements set voided_at = now(), voided_by = $2, void_reason = $3 where id = $1`, [id, user.id, reason]);
    for (const c of counts) await refreshMoves(tx, c.count_id);
    await audit(tx, user.id, "movement.void", "movement", id, null, { voided: true }, reason);
  });
}

export interface MovementView {
  id: number;
  kind: MoveKind;
  supplier: string | null;
  reason: string | null;
  note: string | null;
  photoKey: string | null;
  recordedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  createdBy: string;
  fromName: string | null;
  toName: string | null;
  lines: { name: string; unit: string; qty: number; direction: "in" | "out" }[];
  canVoid: boolean;
}

export async function listMovements(user: User, days = 7): Promise<MovementView[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    kind: MoveKind;
    supplier: string | null;
    reason: string | null;
    note: string | null;
    photo_key: string | null;
    recorded_at: Date;
    voided_at: Date | null;
    void_reason: string | null;
    created_by: number;
    created_by_name: string;
    from_name: string | null;
    to_name: string | null;
    lines: { name: string; unit: string; qty: number; direction: "in" | "out"; locked: boolean }[];
  }>(
    `select m.id, m.kind, m.supplier, m.reason, m.note, m.photo_key, m.recorded_at, m.voided_at, m.void_reason,
            m.created_by, u.name as created_by_name, lf.name as from_name, lt.name as to_name,
            json_agg(json_build_object(
              'name', coalesce(nullif(i.name_en, ''), i.name_th), 'unit', i.unit, 'qty', ml.qty,
              'direction', ml.direction, 'locked', coalesce(c.status <> 'draft', false)
            ) order by ml.id) as lines
     from movements m
     join users u on u.id = m.created_by
     left join locations lf on lf.id = m.from_location_id
     left join locations lt on lt.id = m.to_location_id
     join movement_lines ml on ml.movement_id = m.id
     join items i on i.id = ml.item_id
     left join counts c on c.id = ml.count_id
     where m.outlet_id = $1 and m.recorded_at >= now() - make_interval(days => $2)
     group by m.id, u.name, lf.name, lt.name
     order by m.recorded_at desc
     limit 200`,
    [user.outletId, days],
  );
  return rows.map((r) => {
    const lines = typeof r.lines === "string" ? JSON.parse(r.lines) : r.lines;
    return {
      id: r.id,
      kind: r.kind,
      supplier: r.supplier,
      reason: r.reason,
      note: r.note,
      photoKey: r.photo_key,
      recordedAt: r.recorded_at,
      voidedAt: r.voided_at,
      voidReason: r.void_reason,
      createdBy: r.created_by_name,
      fromName: r.from_name,
      toName: r.to_name,
      // A transfer stores out + in lines; show the outgoing side once.
      lines: lines
        .filter((l: { direction: string }) => r.kind !== "transfer" || l.direction === "out")
        .map((l: { name: string; unit: string; qty: number; direction: "in" | "out" }) => ({
          name: l.name,
          unit: l.unit,
          qty: Number(l.qty),
          direction: l.direction,
        })),
      canVoid:
        !r.voided_at &&
        (r.created_by === user.id || can.review(user.role)) &&
        !lines.some((l: { locked: boolean }) => l.locked),
    };
  });
}

/** มูลค่าของเสีย (ตามราคาทุน) ในช่วงวันทำการ */
export async function wasteValue(user: User, from: string, to: string): Promise<number> {
  const db = await getDb();
  const [{ value }] = await db.query<{ value: number | null }>(
    `select sum(ml.qty * i.unit_cost) as value
     from movements m join movement_lines ml on ml.movement_id = m.id join items i on i.id = ml.item_id
     where m.outlet_id = $1 and m.kind = 'waste' and m.voided_at is null
       and ((m.recorded_at at time zone 'Asia/Bangkok') - interval '6 hours')::date between $2 and $3`,
    [user.outletId, from, to],
  );
  return Math.round((value ?? 0) * 100) / 100;
}
