import "server-only";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { HttpError, LOCK_MINUTES, issueSession, reservePinTry, type User } from "./session";
import { cleanPin, text } from "./settings";
import { audit } from "./stock";
import { tk } from "@/i18n";

// Self-service on the Me page: every role can change its own display name and PIN.

export async function updateOwnName(user: User, rawName: string) {
  const name = text(rawName, tk("ชื่อที่แสดง"), 60);
  if (name === user.name) return;
  const db = await getDb();
  await db.tx(async (tx) => {
    await tx.query(`update users set name = $2 where id = $1`, [user.id, name]);
    await audit(tx, user.id, "user.update", "user", user.id, { name: user.name }, { name });
  });
}

/** Needs the current PIN (a wrong one counts toward the sign-in lock). Signs out every
 * other device; this one gets a fresh session so the user stays signed in here. */
export async function changeOwnPin(user: User, currentPin: string, rawPin: string) {
  if (typeof currentPin !== "string" || !/^\d{6}$/.test(currentPin)) throw new HttpError(400, "กรอก PIN เดิม 6 หลัก");
  const pin = cleanPin(rawPin);
  if (pin === currentPin) throw new HttpError(400, "PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม");
  const db = await getDb();
  const [u] = await db.query<{ pin_hash: string }>(`select pin_hash from users where id = $1 and active`, [user.id]);
  if (!u) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  if (!(await reservePinTry(db, user.id))) {
    throw new HttpError(429, "ใส่ PIN ผิดหลายครั้ง ลองใหม่ใน {n} นาที", { n: LOCK_MINUTES });
  }
  if (!(await bcrypt.compare(currentPin, u.pin_hash))) throw new HttpError(400, "PIN เดิมไม่ถูกต้อง");
  const sv = await db.tx(async (tx) => {
    const [r] = await tx.query<{ session_version: number }>(
      `update users set pin_hash = $2, failed_attempts = 0, locked_until = null, session_version = session_version + 1
       where id = $1 returning session_version`,
      [user.id, bcrypt.hashSync(pin, 10)],
    );
    await audit(tx, user.id, "user.change_pin", "user", user.id, null, null);
    return r.session_version;
  });
  await issueSession(user.id, sv);
}
