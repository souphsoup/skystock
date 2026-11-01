import "server-only";
import { getDb, type Db } from "./db";
import { HttpError, type User } from "./session";
import { audit, openingOf } from "./stock";
import { insertItem, updateItemTx, type ItemInput } from "./settings";
import { businessDate } from "./dates";
import { round2 } from "./types";
import type { ProposalInput, ProposalStatus, SheetProposal } from "./proposal-types";

export { sheetProposals } from "./proposal-sheet";

const MAX_QTY = 1_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneLine = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// ---------------------------------------------------------------- staff: propose

export async function proposeItem(user: User, input: ProposalInput): Promise<{ id: number; duplicate: boolean }> {
  if (!input || typeof input !== "object") throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
  const clientId = String(input.clientId ?? "");
  if (!UUID.test(clientId)) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
  const nameTh = oneLine(input.nameTh, 80);
  const nameEn = oneLine(input.nameEn, 80);
  const unit = oneLine(input.unit, 20);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) : "";
  if (!nameTh) throw new HttpError(400, "กรุณาใส่ชื่อรายการ");
  if (!unit) throw new HttpError(400, "กรุณาเลือกหน่วยนับ");
  let counted: number | null = null;
  if (input.counted !== null && input.counted !== undefined) {
    if (typeof input.counted !== "number" || !Number.isFinite(input.counted) || input.counted < 0 || input.counted > MAX_QTY) {
      throw new HttpError(400, "จำนวนที่นับได้ไม่ถูกต้อง");
    }
    counted = round2(input.counted);
  }
  // A queued proposal belongs to the day it was made, but never the future.
  const at = Number(input.recordedAt);
  const when = Number.isFinite(at) ? new Date(Math.min(at, Date.now())) : new Date();

  const db = await getDb();
  return db.tx(async (tx) => {
    const [seen] = await tx.query<{ id: number }>(`select id from item_proposals where client_id = $1`, [clientId]);
    if (seen) return { id: seen.id, duplicate: true };

    const [loc] = await tx.query<{ outlet_id: number }>(`select outlet_id from locations where id = $1 and active`, [
      Number(input.locationId),
    ]);
    if (!loc || loc.outlet_id !== user.outletId) throw new HttpError(400, "กรุณาเลือกจุดเก็บ");

    const [exists] = await tx.query<{ name_th: string }>(
      `select name_th from items where location_id = $1 and active and lower(name_th) = lower($2)`,
      [input.locationId, nameTh],
    );
    if (exists) throw new HttpError(409, 'มี "{name}" ในใบนับนี้อยู่แล้ว ค้นหาแล้วนับได้เลย', { name: exists.name_th });
    const [waiting] = await tx.query<{ name_th: string }>(
      `select name_th from item_proposals where location_id = $1 and status = 'pending' and lower(name_th) = lower($2)`,
      [input.locationId, nameTh],
    );
    if (waiting) throw new HttpError(409, 'มีคนเสนอ "{name}" ไว้แล้ว รอหัวหน้าอนุมัติ', { name: waiting.name_th });

    const [r] = await tx.query<{ id: number }>(
      `insert into item_proposals (outlet_id, client_id, location_id, name_th, name_en, unit, counted, note, business_date, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [user.outletId, clientId, input.locationId, nameTh, nameEn, unit, counted, note || null, businessDate(when), user.id],
    );
    await audit(tx, user.id, "proposal.create", "item_proposal", r.id, null, { locationId: input.locationId, nameTh, nameEn, unit, counted });
    return { id: r.id, duplicate: false };
  });
}

// ---------------------------------------------------------------- supervisor: decide

export interface ProposalView extends SheetProposal {
  locationId: number;
  locationName: string;
  note: string | null;
  businessDate: string;
  createdAt: string;
  /** an inactive item with the same name at that location: approving switches it back on */
  inactiveItemId: number | null;
  /** status of the count round for that location and day, if any */
  countStatus: string | null;
}

const VIEW_SQL = `
  select p.*, u.name as by_name, loc.name as location_name,
         (select i.id from items i where i.location_id = p.location_id and not i.active
            and lower(i.name_th) = lower(p.name_th) order by i.id desc limit 1) as inactive_item_id,
         (select c.status from counts c where c.location_id = p.location_id and c.business_date = p.business_date) as count_status
  from item_proposals p join users u on u.id = p.created_by join locations loc on loc.id = p.location_id`;

interface ViewRow {
  id: number;
  outlet_id: number;
  location_id: number;
  location_name: string;
  name_th: string;
  name_en: string;
  unit: string;
  counted: number | null;
  note: string | null;
  status: ProposalStatus;
  reject_reason: string | null;
  business_date: string;
  created_at: Date;
  created_by: number;
  by_name: string;
  inactive_item_id: number | null;
  count_status: string | null;
}

const toView = (r: ViewRow): ProposalView => ({
  id: r.id,
  nameTh: r.name_th,
  nameEn: r.name_en,
  unit: r.unit,
  counted: r.counted,
  status: r.status,
  rejectReason: r.reject_reason,
  by: r.by_name,
  locationId: r.location_id,
  locationName: r.location_name,
  note: r.note,
  businessDate: r.business_date,
  createdAt: new Date(r.created_at).toISOString(),
  inactiveItemId: r.inactive_item_id,
  countStatus: r.count_status,
});

export async function pendingProposals(user: User): Promise<ProposalView[]> {
  const db = await getDb();
  const rows = await db.query<ViewRow>(`${VIEW_SQL} where p.outlet_id = $1 and p.status = 'pending' order by p.created_at`, [
    user.outletId,
  ]);
  return rows.map(toView);
}

export async function getProposal(user: User, id: number): Promise<ProposalView> {
  const db = await getDb();
  const [r] = await db.query<ViewRow>(`${VIEW_SQL} where p.id = $1`, [id]);
  if (!r || r.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบรายการที่เสนอ");
  return toView(r);
}

async function lockPending(tx: Db, user: User, id: number) {
  const [p] = await tx.query<ViewRow>(`select * from item_proposals where id = $1 for update`, [id]);
  if (!p || p.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบรายการที่เสนอ");
  if (p.status !== "pending") throw new HttpError(409, "รายการนี้มีคนตัดสินไปแล้ว");
  return p;
}

/** What happened to the proposer's count when the item was created. */
export type CountedResult = "draft" | "review" | "next" | "none";

/**
 * Creates the item (or switches a same-named inactive item back on) with the
 * supervisor's edits. If the proposer counted it, the figure goes into that day's
 * count: still being counted → filled in; waiting for review → added as a checked
 * line; already approved or no count → the item starts in the next count.
 */
export async function approveProposal(
  user: User,
  id: number,
  input: ItemInput,
): Promise<{ itemId: number; counted: CountedResult }> {
  const db = await getDb();
  return db.tx(async (tx) => {
    const p = await lockPending(tx, user, id);
    const fields: ItemInput = { ...input, active: true };
    const [inactive] = await tx.query<{ id: number }>(
      `select id from items where location_id = $1 and not active and lower(name_th) = lower($2) order by id desc limit 1`,
      [fields.locationId, fields.nameTh],
    );
    const itemId = inactive ? (await updateItemTx(tx, user, inactive.id, fields), inactive.id) : await insertItem(tx, user, fields);

    let counted: CountedResult = "none";
    const [c] = await tx.query<{ id: number; status: string }>(
      `select id, status from counts where location_id = $1 and business_date = $2`,
      [fields.locationId, p.business_date],
    );
    if (c && p.counted !== null && Number(fields.locationId) === p.location_id) {
      if (c.status === "draft") {
        await tx.query(
          `insert into count_lines (count_id, item_id, business_date, opening, counted, counted_by)
           select $1, $2, $3::date, ${openingOf("$2", "$3::date")}, $4, $5
           on conflict (count_id, item_id) do update set counted = excluded.counted, counted_by = excluded.counted_by
             where count_lines.counted is null`,
          [c.id, itemId, p.business_date, p.counted, p.created_by],
        );
        counted = "draft";
      } else if (c.status === "submitted" || c.status === "recount") {
        await tx.query(
          `insert into count_lines (count_id, item_id, business_date, opening, counted, counted_by)
           select $1, $2, $3::date, ${openingOf("$2", "$3::date")}, $4, $5
           on conflict (count_id, item_id) do nothing`,
          [c.id, itemId, p.business_date, p.counted, p.created_by],
        );
        await tx.query(
          `update count_lines set status = case when expected is null or counted = expected then 'ok' else 'flag' end
           where count_id = $1 and item_id = $2`,
          [c.id, itemId],
        );
        counted = "review";
      } else {
        counted = "next";
      }
    } else if (p.counted !== null) {
      counted = "next";
    }

    await tx.query(
      `update item_proposals set status = 'approved', decided_by = $2, decided_at = now(), item_id = $3 where id = $1`,
      [id, user.id, itemId],
    );
    await audit(tx, user.id, "proposal.approve", "item_proposal", id, { status: "pending" },
      { status: "approved", itemId, reactivated: !!inactive, counted });
    return { itemId, counted };
  });
}

export async function rejectProposal(user: User, id: number, rawReason: unknown) {
  const reason = oneLine(rawReason, 200);
  if (!reason) throw new HttpError(400, "กรุณาใส่เหตุผลที่ไม่อนุมัติ");
  const db = await getDb();
  await db.tx(async (tx) => {
    await lockPending(tx, user, id);
    await tx.query(
      `update item_proposals set status = 'rejected', decided_by = $2, decided_at = now(), reject_reason = $3 where id = $1`,
      [id, user.id, reason],
    );
    await audit(tx, user.id, "proposal.reject", "item_proposal", id, { status: "pending" }, { status: "rejected", reason });
  });
}
