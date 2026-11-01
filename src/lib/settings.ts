import "server-only";
import bcrypt from "bcryptjs";
import { getDb, type Db } from "./db";
import { HttpError, type User } from "./session";
import { tk } from "@/i18n";
import { audit } from "./stock";
import type { Role } from "./types";

import { DEFAULT_UNITS } from "./catalog-tree";

export { DEFAULT_UNITS };

export interface CatalogLocation {
  id: number;
  code: string;
  name: string;
}
export interface CatalogCategory {
  id: number;
  parentId: number | null;
  name: string;
  level: number;
}
export interface CatalogItem {
  id: number;
  categoryId: number | null;
  locationId: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  unitCost: number;
  par: number;
  blind: boolean;
  active: boolean;
}
export interface Catalog {
  locations: CatalogLocation[];
  categories: CatalogCategory[];
  items: CatalogItem[];
  units: string[];
}

export async function getCatalog(user: User): Promise<Catalog> {
  const db = await getDb();
  const [locations, categories, items] = await Promise.all([
    db.query<CatalogLocation>(
      `select id, code, name from locations where outlet_id = $1 and active order by sort_order, id`,
      [user.outletId],
    ),
    db.query<CatalogCategory>(
      `select id, parent_id as "parentId", name, level from categories where outlet_id = $1 order by sort_order, id`,
      [user.outletId],
    ),
    db.query<CatalogItem>(
      `select id, category_id as "categoryId", location_id as "locationId", name_th as "nameTh", name_en as "nameEn",
              unit, unit_cost as "unitCost", par, blind, active
       from items where outlet_id = $1 order by sort_order, id`,
      [user.outletId],
    ),
  ]);
  const units = [...new Set([...DEFAULT_UNITS, ...items.map((i) => i.unit)])];
  return { locations, categories, items, units };
}

const text = (v: unknown, field: string, max = 80): string => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!s) throw new HttpError(400, "กรุณากรอก{field}", { field });
  if (s.length > max) throw new HttpError(400, "{field}ยาวเกิน {max} ตัวอักษร", { field, max });
  return s;
};

const qty = (v: unknown, field: string): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HttpError(400, "{field}ไม่ถูกต้อง", { field });
  return Math.round(n * 100) / 100;
};

async function ownCategory(db: Db, user: User, id: number) {
  const [c] = await db.query<{ id: number; level: number; outlet_id: number; name: string; parent_id: number | null }>(
    `select id, level, outlet_id, name, parent_id from categories where id = $1`,
    [id],
  );
  if (!c || c.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบหมวดนี้");
  return c;
}

// ---------------------------------------------------------------- categories

/** เพิ่มหมวด (parentId = null) หรือชนิด/ส่วนใต้หมวดเดิม สูงสุด 3 ชั้น */
export async function addCategory(user: User, parentId: number | null, rawName: string): Promise<number> {
  const name = text(rawName, tk("ชื่อหมวด"), 60);
  const db = await getDb();
  return db.tx(async (tx) => {
    let level = 1;
    if (parentId !== null) {
      const parent = await ownCategory(tx, user, parentId);
      if (parent.level >= 3) throw new HttpError(400, "แบ่งได้สูงสุด 3 ชั้น: หมวด › ชนิด › ส่วน");
      level = parent.level + 1;
    }
    const [dup] = await tx.query(
      `select 1 from categories where outlet_id = $1 and parent_id is not distinct from $2 and lower(name) = lower($3)`,
      [user.outletId, parentId, name],
    );
    if (dup) throw new HttpError(409, 'มี "{name}" ในระดับนี้แล้ว', { name });
    const [r] = await tx.query<{ id: number }>(
      `insert into categories (outlet_id, parent_id, name, level, sort_order)
       values ($1, $2, $3, $4, (select coalesce(max(sort_order), 0) + 1 from categories where outlet_id = $1))
       returning id`,
      [user.outletId, parentId, name, level],
    );
    await audit(tx, user.id, "category.create", "category", r.id, null, { name, parentId, level });
    return r.id;
  });
}

export async function renameCategory(user: User, id: number, rawName: string) {
  const name = text(rawName, tk("ชื่อหมวด"), 60);
  const db = await getDb();
  await db.tx(async (tx) => {
    const c = await ownCategory(tx, user, id);
    const [dup] = await tx.query(
      `select 1 from categories where outlet_id = $1 and parent_id is not distinct from $2 and lower(name) = lower($3) and id <> $4`,
      [user.outletId, c.parent_id, name, id],
    );
    if (dup) throw new HttpError(409, 'มี "{name}" ในระดับนี้แล้ว', { name });
    await tx.query(`update categories set name = $2 where id = $1`, [id, name]);
    await audit(tx, user.id, "category.rename", "category", id, { name: c.name }, { name });
  });
}

/** ลบได้เฉพาะหมวดที่ว่าง (ไม่มีชนิดย่อยและไม่มีรายการ) เพื่อไม่ให้ประวัติหลุดหมวด */
export async function deleteCategory(user: User, id: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    const c = await ownCategory(tx, user, id);
    const [{ n }] = await tx.query<{ n: number }>(
      `select (select count(*) from categories where parent_id = $1) + (select count(*) from items where category_id = $1) as n`,
      [id],
    );
    if (n > 0) throw new HttpError(409, "ย้ายรายการและชนิดย่อยออกก่อน จึงจะลบหมวดนี้ได้");
    await tx.query(`delete from categories where id = $1`, [id]);
    await audit(tx, user.id, "category.delete", "category", id, { name: c.name }, null);
  });
}

// ---------------------------------------------------------------- items

export interface ItemInput {
  categoryId: number | null;
  locationId: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  unitCost: number;
  par: number;
  blind: boolean;
  active: boolean;
}

async function cleanItem(db: Db, user: User, input: ItemInput) {
  const out = {
    categoryId: input.categoryId ? Number(input.categoryId) : null,
    locationId: Number(input.locationId),
    nameTh: text(input.nameTh, tk("ชื่อไทย")),
    nameEn: typeof input.nameEn === "string" ? input.nameEn.trim().replace(/\s+/g, " ").slice(0, 80) : "",
    unit: text(input.unit, tk("หน่วยนับ"), 20),
    unitCost: qty(input.unitCost, tk("ราคาทุน")),
    par: qty(input.par, tk("จำนวนขั้นต่ำ (Par)")),
    blind: !!input.blind,
    active: input.active !== false,
  };
  if (out.categoryId !== null) await ownCategory(db, user, out.categoryId);
  const [loc] = await db.query<{ outlet_id: number }>(`select outlet_id from locations where id = $1 and active`, [
    out.locationId,
  ]);
  if (!loc || loc.outlet_id !== user.outletId) throw new HttpError(400, "กรุณาเลือกจุดเก็บ");
  return out;
}

async function assertUniqueName(db: Db, user: User, locationId: number, nameTh: string, exceptId?: number) {
  const [dup] = await db.query(
    `select 1 from items where outlet_id = $1 and location_id = $2 and lower(name_th) = lower($3) and id <> $4`,
    [user.outletId, locationId, nameTh, exceptId ?? 0],
  );
  if (dup) throw new HttpError(409, 'มี "{name}" ในจุดเก็บนี้แล้ว', { name: nameTh });
}

export async function createItem(user: User, input: ItemInput): Promise<number> {
  const db = await getDb();
  return db.tx((tx) => insertItem(tx, user, input));
}

/** createItem inside a caller's transaction (also used when approving a proposed item). */
export async function insertItem(tx: Db, user: User, input: ItemInput): Promise<number> {
  const it = await cleanItem(tx, user, input);
  await assertUniqueName(tx, user, it.locationId, it.nameTh);
  const [r] = await tx.query<{ id: number }>(
    `insert into items (outlet_id, category_id, location_id, name_th, name_en, unit, unit_cost, par, blind, active, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
             (select coalesce(max(sort_order), 0) + 1 from items where location_id = $3))
     returning id`,
    [user.outletId, it.categoryId, it.locationId, it.nameTh, it.nameEn, it.unit, it.unitCost, it.par, it.blind, it.active],
  );
  await audit(tx, user.id, "item.create", "item", r.id, null, it);
  return r.id;
}

export async function updateItem(user: User, id: number, input: ItemInput) {
  const db = await getDb();
  await db.tx((tx) => updateItemTx(tx, user, id, input));
}

/** updateItem inside a caller's transaction. */
export async function updateItemTx(tx: Db, user: User, id: number, input: ItemInput) {
  const [before] = await tx.query<CatalogItem & { outlet_id: number }>(
    `select id, outlet_id, category_id as "categoryId", location_id as "locationId", name_th as "nameTh", name_en as "nameEn",
            unit, unit_cost as "unitCost", par, blind, active
     from items where id = $1 for update`,
    [id],
  );
  if (!before || before.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบรายการนี้");
  const it = await cleanItem(tx, user, input);
  await assertUniqueName(tx, user, it.locationId, it.nameTh, id);
  const moved = it.locationId !== before.locationId;
  await tx.query(
    `update items set category_id = $2, location_id = $3, name_th = $4, name_en = $5, unit = $6, unit_cost = $7,
            par = $8, blind = $9, active = $10,
            sort_order = case when $11 then (select coalesce(max(sort_order), 0) + 1 from items where location_id = $3) else sort_order end
     where id = $1`,
    [id, it.categoryId, it.locationId, it.nameTh, it.nameEn, it.unit, it.unitCost, it.par, it.blind, it.active, moved],
  );
  const { outlet_id: _, ...prev } = before;
  void _;
  await audit(tx, user.id, "item.update", "item", id, prev, it);
}

// ---------------------------------------------------------------- users

export interface UserRow {
  id: number;
  login: string;
  name: string;
  role: Role;
  active: boolean;
  locked: boolean;
}

const ROLES: Role[] = ["operation", "supervisor", "manager", "admin"];

export async function listUsers(user: User): Promise<UserRow[]> {
  const db = await getDb();
  return db.query<UserRow>(
    `select id, login, name, role, active, coalesce(locked_until > now(), false) as locked
     from users where outlet_id = $1 and approval is null
     order by active desc, array_position(array['admin','manager','supervisor','operation'], role), name`,
    [user.outletId],
  );
}

export function cleanPin(pin: unknown): string {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) throw new HttpError(400, "PIN ต้องเป็นตัวเลข 6 หลัก");
  if (/^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "654321") {
    throw new HttpError(400, "PIN นี้เดาง่ายเกินไป เลือกตัวเลขอื่น");
  }
  return pin;
}

export async function createUser(
  admin: User,
  input: { login: string; name: string; role: Role; pin: string },
): Promise<number> {
  const login = text(input.login, tk("ชื่อผู้ใช้"), 30).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(login)) throw new HttpError(400, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ -");
  const name = text(input.name, tk("ชื่อที่แสดง"), 60);
  if (!ROLES.includes(input.role)) throw new HttpError(400, "กรุณาเลือกบทบาท");
  const pin = cleanPin(input.pin);
  const db = await getDb();
  return db.tx(async (tx) => {
    const [dup] = await tx.query(`select 1 from users where login = $1`, [login]);
    if (dup) throw new HttpError(409, 'ชื่อผู้ใช้ "{login}" ถูกใช้แล้ว', { login });
    const [r] = await tx.query<{ id: number }>(
      `insert into users (outlet_id, login, name, role, pin_hash) values ($1,$2,$3,$4,$5) returning id`,
      [admin.outletId, login, name, input.role, bcrypt.hashSync(pin, 10)],
    );
    await audit(tx, admin.id, "user.create", "user", r.id, null, { login, name, role: input.role });
    return r.id;
  });
}

async function ownUser(db: Db, admin: User, id: number) {
  const [u] = await db.query<{ id: number; outlet_id: number; login: string; role: Role; active: boolean; name: string }>(
    `select id, outlet_id, login, role, active, name from users where id = $1 and approval is null for update`,
    [id],
  );
  if (!u || u.outlet_id !== admin.outletId) throw new HttpError(404, "ไม่พบผู้ใช้นี้");
  return u;
}

export async function updateUser(admin: User, id: number, input: { name: string; role: Role }) {
  const name = text(input.name, tk("ชื่อที่แสดง"), 60);
  if (!ROLES.includes(input.role)) throw new HttpError(400, "กรุณาเลือกบทบาท");
  const db = await getDb();
  await db.tx(async (tx) => {
    const u = await ownUser(tx, admin, id);
    if (u.id === admin.id && input.role !== "admin") throw new HttpError(400, "เปลี่ยนบทบาทของตัวเองไม่ได้");
    // Changing the role signs the user out everywhere so the new permissions apply at once.
    await tx.query(
      `update users set name = $2, role = $3,
         session_version = session_version + case when role <> $3 then 1 else 0 end
       where id = $1`,
      [id, name, input.role],
    );
    await audit(tx, admin.id, "user.update", "user", id, { name: u.name, role: u.role }, { name, role: input.role });
  });
}

/** ตั้ง PIN ใหม่ ปลดล็อก และตัด session เดิมทุกเครื่อง */
export async function resetPin(admin: User, id: number, rawPin: string) {
  const pin = cleanPin(rawPin);
  const db = await getDb();
  await db.tx(async (tx) => {
    await ownUser(tx, admin, id);
    await tx.query(
      `update users set pin_hash = $2, failed_attempts = 0, locked_until = null, session_version = session_version + 1 where id = $1`,
      [id, bcrypt.hashSync(pin, 10)],
    );
    await audit(tx, admin.id, "user.reset_pin", "user", id, null, null);
  });
}

/** ปิด/เปิดบัญชี — ปิดแล้วตัด session ทุกเครื่องทันที */
export async function setUserActive(admin: User, id: number, active: boolean) {
  const db = await getDb();
  await db.tx(async (tx) => {
    const u = await ownUser(tx, admin, id);
    if (u.id === admin.id) throw new HttpError(400, "ปิดบัญชีของตัวเองไม่ได้");
    await tx.query(
      `update users set active = $2, session_version = session_version + case when $2 then 0 else 1 end where id = $1`,
      [id, active],
    );
    await audit(tx, admin.id, active ? "user.activate" : "user.deactivate", "user", id, { active: u.active }, { active });
  });
}

/** ตัด session ทุกเครื่อง (เช่น อุปกรณ์หาย) */
export async function revokeSessions(admin: User, id: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    await ownUser(tx, admin, id);
    await tx.query(`update users set session_version = session_version + 1 where id = $1`, [id]);
    await audit(tx, admin.id, "user.revoke_sessions", "user", id, null, null);
  });
}
