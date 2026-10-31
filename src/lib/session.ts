import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { getDb } from "./db";
import type { Role } from "./types";
import { LANG_COOKIE, tk, type Lang, type Params } from "@/i18n";

export const SESSION_COOKIE = "sop_session";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 5;

export interface User {
  id: number;
  outletId: number;
  name: string;
  login: string;
  role: Role;
  lang: Lang;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
    return new TextEncoder().encode("dev-only-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(s);
}

let _dummyHash: string | undefined;
const dummyHash = () => (_dummyHash ??= bcrypt.hashSync("dummy-pin", 10));

export async function login(
  loginName: string,
  pin: string,
): Promise<{ ok: true; user: User } | { ok: false; error: string; params?: Params }> {
  const db = await getDb();
  const [u] = await db.query<{
    id: number;
    outlet_id: number;
    name: string;
    login: string;
    role: Role;
    pin_hash: string;
    active: boolean;
    session_version: number;
    failed_attempts: number;
    locked_until: Date | null;
    lang: Lang;
  }>(`select * from users where login = $1`, [loginName.trim().toLowerCase()]);

  const fail = { ok: false as const, error: tk("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง") };
  if (!u || !u.active) {
    await bcrypt.compare(pin, dummyHash()); // keep timing similar to a real check
    return fail;
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    return { ok: false, error: tk("ใส่ PIN ผิดหลายครั้ง ลองใหม่ใน {n} นาที"), params: { n: LOCK_MINUTES } };
  }
  if (!(await bcrypt.compare(pin, u.pin_hash))) {
    await db.query(
      `update users set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= $2 then now() + make_interval(mins => $3) end
       where id = $1`,
      [u.id, MAX_FAILED, LOCK_MINUTES],
    );
    return fail;
  }
  await db.query(`update users set failed_attempts = 0, locked_until = null where id = $1`, [u.id]);

  const token = await new SignJWT({ sv: u.session_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(u.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  await rememberLang(u.lang);
  return { ok: true, user: { id: u.id, outletId: u.outlet_id, name: u.name, login: u.login, role: u.role, lang: u.lang } };
}

/** The login page shows the last language used on this device. */
export async function rememberLang(lang: Lang) {
  (await cookies()).set(LANG_COOKIE, lang, { sameSite: "lax", path: "/", maxAge: 365 * 24 * 3600 });
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user, or null. Checks the token, that the account is active, and
 * that its session_version still matches (Admin can revoke all sessions). */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const db = await getDb();
    const [u] = await db.query<{
      id: number;
      outlet_id: number;
      name: string;
      login: string;
      role: Role;
      session_version: number;
      lang: Lang;
    }>(`select id, outlet_id, name, login, role, session_version, lang from users where id = $1 and active`, [
      Number(payload.sub),
    ]);
    if (!u || u.session_version !== payload.sv) return null;
    return { id: u.id, outletId: u.outlet_id, name: u.name, login: u.login, role: u.role, lang: u.lang };
  } catch {
    return null;
  }
});

/** For pages: redirect to /login when signed out, or home when the role is not allowed. */
export async function requireUser(allowed?: (r: Role) => boolean): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (allowed && !allowed(u.role)) redirect("/");
  return u;
}

/** message is a Thai translation key; {placeholders} are filled from params (see src/i18n). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public params?: Params,
  ) {
    super(message);
  }
}

/** For route handlers and server actions: throws HttpError instead of redirecting. */
export async function requireApiUser(allowed?: (r: Role) => boolean): Promise<User> {
  const u = await getUser();
  if (!u) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  if (allowed && !allowed(u.role)) throw new HttpError(403, "ไม่มีสิทธิ์ทำรายการนี้");
  return u;
}
