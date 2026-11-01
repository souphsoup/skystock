import "server-only";
import bcrypt from "bcryptjs";
import { getDb, type Db } from "./db";
import { HttpError, type User } from "./session";
import { cleanPin, text } from "./settings";
import { audit } from "./stock";
import { tk } from "@/i18n";
import type { Role } from "./types";

// New staff sign up on /signup. The account waits as approval = 'pending' (active = false,
// so it cannot sign in) until an Admin approves it and picks the role.

/** Stops a flood of fake requests from the public page filling the Admin's queue. */
const MAX_PENDING = 30;
const ROLES: Role[] = ["operation", "supervisor", "manager", "admin"];

export async function signup(input: { login: unknown; name: unknown; pin: unknown; pin2: unknown }): Promise<void> {
  const login = text(input.login, tk("ชื่อผู้ใช้"), 30).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(login)) throw new HttpError(400, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ -");
  const name = text(input.name, tk("ชื่อที่แสดง"), 60);
  const pin = cleanPin(input.pin);
  if (input.pin2 !== pin) throw new HttpError(400, "PIN ทั้งสองช่องไม่ตรงกัน");
  const hash = bcrypt.hashSync(pin, 10);

  const db = await getDb();
  await db.tx(async (tx) => {
    // One shop per install today: requests go to the first outlet.
    const [outlet] = await tx.query<{ id: number }>(`select id from outlets order by id limit 1`);
    if (!outlet) throw new HttpError(503, "ระบบยังไม่พร้อมรับสมัคร ติดต่อ Admin");
    const [{ n }] = await tx.query<{ n: number }>(
      `select count(*)::int as n from users where outlet_id = $1 and approval = 'pending'`,
      [outlet.id],
    );
    if (n >= MAX_PENDING) throw new HttpError(429, "มีคำขอรออนุมัติอยู่มาก ติดต่อ Admin โดยตรง");

    const [dup] = await tx.query<{ id: number; approval: string | null }>(
      `select id, approval from users where login = $1 for update`,
      [login],
    );
    if (dup && dup.approval !== "rejected") throw new HttpError(409, 'ชื่อผู้ใช้ "{login}" ถูกใช้แล้ว', { login });
    let id: number;
    if (dup) {
      // A rejected request frees its login: reuse the row (login_events may point at it).
      await tx.query(
        `update users set name = $2, pin_hash = $3, role = 'operation', approval = 'pending', active = false,
           failed_attempts = 0, locked_until = null, created_at = now()
         where id = $1`,
        [dup.id, name, hash],
      );
      id = dup.id;
    } else {
      const [r] = await tx.query<{ id: number }>(
        `insert into users (outlet_id, login, name, role, pin_hash, active, approval)
         values ($1, $2, $3, 'operation', $4, false, 'pending') returning id`,
        [outlet.id, login, name, hash],
      );
      id = r.id;
    }
    await audit(tx, id, "user.signup", "user", id, null, { login, name });
  });
}

export interface SignupRow {
  id: number;
  login: string;
  name: string;
  createdAt: Date;
}

export async function listSignups(admin: User): Promise<SignupRow[]> {
  const db = await getDb();
  return db.query<SignupRow>(
    `select id, login, name, created_at as "createdAt" from users
     where outlet_id = $1 and approval = 'pending' order by created_at`,
    [admin.outletId],
  );
}

export async function countSignups(admin: User): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>(
    `select count(*)::int as n from users where outlet_id = $1 and approval = 'pending'`,
    [admin.outletId],
  );
  return n;
}

async function pendingUser(tx: Db, admin: User, id: number) {
  const [u] = await tx.query<{ id: number; login: string; name: string }>(
    `select id, login, name from users where id = $1 and outlet_id = $2 and approval = 'pending' for update`,
    [id, admin.outletId],
  );
  if (!u) throw new HttpError(404, "คำขอนี้ถูกจัดการไปแล้ว");
  return u;
}

export async function approveSignup(admin: User, id: number, role: Role) {
  if (!ROLES.includes(role)) throw new HttpError(400, "กรุณาเลือกบทบาท");
  const db = await getDb();
  await db.tx(async (tx) => {
    const u = await pendingUser(tx, admin, id);
    await tx.query(`update users set approval = null, active = true, role = $2 where id = $1`, [id, role]);
    await audit(tx, admin.id, "user.approve", "user", id, null, { login: u.login, name: u.name, role });
  });
}

export async function rejectSignup(admin: User, id: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    const u = await pendingUser(tx, admin, id);
    await tx.query(`update users set approval = 'rejected', active = false where id = $1`, [id]);
    await audit(tx, admin.id, "user.reject", "user", id, null, { login: u.login, name: u.name });
  });
}
