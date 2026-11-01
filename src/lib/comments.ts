import "server-only";
import { getDb, type Db } from "./db";
import { HttpError, type User } from "./session";
import { can, type Role } from "./types";
import { COMMENT_MAX, type CommentInput, type CountComment } from "./comment-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Counters and reviewers talk in a round; the management team only reads reports. */
export const canComment = (r: Role) => can.count(r) || can.review(r);

/** Messages of one count round, oldest first. Callers have already checked the count belongs to the user's outlet. */
export async function countComments(db: Db, user: User, countId: number): Promise<CountComment[]> {
  const rows = await db.query<{
    id: number;
    item_id: number | null;
    body: string;
    created_by: number;
    created_at: Date | string;
    by_name: string;
    by_role: Role;
  }>(
    `select cc.id, cc.item_id, cc.body, cc.created_by, cc.created_at, u.name as by_name, u.role as by_role
     from count_comments cc join users u on u.id = cc.created_by
     where cc.count_id = $1 order by cc.created_at, cc.id`,
    [countId],
  );
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    by: r.by_name,
    byRole: r.by_role,
    mine: r.created_by === user.id,
    body: r.body,
    at: new Date(r.created_at).toISOString(),
  }));
}

export async function addComment(user: User, countId: number, input: CommentInput): Promise<CountComment[]> {
  if (!canComment(user.role)) throw new HttpError(403, "ไม่มีสิทธิ์ทำรายการนี้");
  if (!input || typeof input !== "object") throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
  const clientId = String(input.clientId ?? "");
  if (!UUID.test(clientId)) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
  const body = typeof input.body === "string" ? input.body.trim().replace(/\n{3,}/g, "\n\n") : "";
  if (!body) throw new HttpError(400, "กรุณาพิมพ์ข้อความ");
  if (body.length > COMMENT_MAX) throw new HttpError(400, "ข้อความยาวเกิน {n} ตัวอักษร", { n: COMMENT_MAX });
  const itemId = input.itemId === null || input.itemId === undefined ? null : Number(input.itemId);

  const db = await getDb();
  return db.tx(async (tx) => {
    const [c] = await tx.query<{ outlet_id: number }>(
      `select loc.outlet_id from counts c join locations loc on loc.id = c.location_id where c.id = $1`,
      [countId],
    );
    if (!c || c.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบรอบนับนี้");
    if (itemId !== null) {
      const [line] = await tx.query(`select 1 from count_lines where count_id = $1 and item_id = $2`, [countId, itemId]);
      if (!line) throw new HttpError(404, "ไม่พบรายการนี้");
    }
    // A resend from the offline queue after a lost response stores nothing new.
    await tx.query(
      `insert into count_comments (count_id, item_id, client_id, body, created_by) values ($1,$2,$3,$4,$5)
       on conflict (client_id) do nothing`,
      [countId, itemId, clientId, body, user.id],
    );
    return countComments(tx, user, countId);
  });
}
