import "server-only";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { HttpError, LOCK_MINUTES, issueSession, reservePinTry, type User } from "./session";
import { cleanPin, text } from "./settings";
import { audit } from "./stock";
import { putPhoto } from "./files";
import { tk } from "@/i18n";
import { businessDate } from "./dates";
import { EMPTY_PROFILE, type Profile } from "./profile-types";

// Self-service on the Me page: every role can change its own display name, PIN, photo and
// personal details. Personal details are seen only by the owner and Admin (settings/users).

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

const PROFILE_COLS = `full_name, nickname, phone, email, line_id, to_char(birthday, 'YYYY-MM-DD') as birthday,
  allergies, emergency_name, emergency_phone`;

type ProfileRow = {
  full_name: string | null;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  line_id: string | null;
  birthday: string | null;
  allergies: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
};

const toProfile = (r: ProfileRow): Profile => ({
  fullName: r.full_name ?? "",
  nickname: r.nickname ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  lineId: r.line_id ?? "",
  birthday: r.birthday ?? "",
  allergies: r.allergies ?? "",
  emergencyName: r.emergency_name ?? "",
  emergencyPhone: r.emergency_phone ?? "",
});

/** Profiles of the given users in the caller's outlet (own profile, or Admin's user list). */
export async function getProfiles(user: User, ids: number[]): Promise<Map<number, Profile>> {
  if (!ids.length) return new Map();
  const db = await getDb();
  const rows = await db.query<ProfileRow & { id: number }>(
    `select id, ${PROFILE_COLS} from users where outlet_id = $1 and id = any($2::int[])`,
    [user.outletId, `{${ids.join(",")}}`],
  );
  return new Map(rows.map((r) => [r.id, toProfile(r)]));
}

export async function getOwnProfile(user: User): Promise<Profile> {
  return (await getProfiles(user, [user.id])).get(user.id) ?? EMPTY_PROFILE;
}

/** Optional one-line text: "" → null. */
function optional(v: unknown, field: string, max: number): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") throw new HttpError(400, "{field}ไม่ถูกต้อง", { field });
  const s = v.trim().replace(/\s+/g, " ");
  if (!s) return null;
  if (s.length > max) throw new HttpError(400, "{field}ยาวเกิน {max} ตัวอักษร", { field, max });
  return s;
}

function phone(v: unknown, field: string): string | null {
  const s = optional(v, field, 20);
  if (s && !/^\+?[\d\s-]{9,19}$/.test(s)) throw new HttpError(400, "{field}ไม่ถูกต้อง", { field });
  return s;
}

function cleanProfile(input: Partial<Record<keyof Profile, unknown>>) {
  const email = optional(input.email, tk("อีเมล"), 120)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "{field}ไม่ถูกต้อง", { field: tk("อีเมล") });
  const birthday = optional(input.birthday, tk("วันเกิด"), 10);
  if (birthday) {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(birthday) && !Number.isNaN(Date.parse(birthday));
    if (!ok || birthday < "1930-01-01" || birthday > businessDate()) {
      throw new HttpError(400, "{field}ไม่ถูกต้อง", { field: tk("วันเกิด") });
    }
  }
  // allergies may span a few lines ("แพ้กุ้ง\nไม่ทานหมู")
  const allergies = typeof input.allergies === "string" ? input.allergies.trim().replace(/[ \t]+/g, " ") : "";
  if (allergies.length > 300) throw new HttpError(400, "{field}ยาวเกิน {max} ตัวอักษร", { field: tk("แพ้อาหาร / อาหารที่ไม่ทาน"), max: 300 });
  return {
    full_name: optional(input.fullName, tk("ชื่อ-นามสกุล"), 100),
    nickname: optional(input.nickname, tk("ชื่อเล่น"), 40),
    phone: phone(input.phone, tk("เบอร์โทร")),
    email,
    line_id: optional(input.lineId, tk("LINE ID"), 60),
    birthday,
    allergies: allergies || null,
    emergency_name: optional(input.emergencyName, tk("ผู้ติดต่อฉุกเฉิน"), 100),
    emergency_phone: phone(input.emergencyPhone, tk("เบอร์ผู้ติดต่อฉุกเฉิน")),
  };
}

/** The audit log keeps only which fields changed, not the values: history is visible to
 * supervisors and managers, personal details are not. */
export async function updateOwnProfile(user: User, input: Partial<Record<keyof Profile, unknown>>) {
  const next = cleanProfile(input);
  const db = await getDb();
  await db.tx(async (tx) => {
    const [cur] = await tx.query<ProfileRow>(`select ${PROFILE_COLS} from users where id = $1 for update`, [user.id]);
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => (cur?.[k] ?? null) !== next[k]);
    if (!changed.length) return;
    await tx.query(
      `update users set full_name = $2, nickname = $3, phone = $4, email = $5, line_id = $6, birthday = $7,
         allergies = $8, emergency_name = $9, emergency_phone = $10
       where id = $1`,
      [user.id, next.full_name, next.nickname, next.phone, next.email, next.line_id, next.birthday,
        next.allergies, next.emergency_name, next.emergency_phone],
    );
    await audit(tx, user.id, "user.profile", "user", user.id, null, { fields: changed });
  });
}

/** photo = null removes it. The client sends a small square JPEG (see avatar-picker.tsx). */
export async function setOwnAvatar(user: User, photo: File | null) {
  let key: string | null = null;
  if (photo && photo.size > 0) {
    if (photo.size > 1024 * 1024) throw new HttpError(413, "รูปใหญ่เกิน 1 MB");
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    // a new name on every upload so the browser never shows a cached old photo
    key = `outlet-${user.outletId}/avatars/${user.id}-${Date.now()}.${ext}`;
    await putPhoto(key, photo);
  }
  const db = await getDb();
  await db.tx(async (tx) => {
    await tx.query(`update users set avatar_key = $2 where id = $1`, [user.id, key]);
    await audit(tx, user.id, key ? "user.avatar" : "user.avatar_remove", "user", user.id, null, null);
  });
}
