import "server-only";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { getDb, type Db } from "./db";
import type { Role } from "./types";
import { LANG_COOKIE, tk, type Lang, type Params } from "@/i18n";

export const SESSION_COOKIE = "sop_session";
const SESSION_HOURS = 12;
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 5;
// Per IP address. Staff on the hotel Wi-Fi share one address, so leave room for honest typos.
const IP_MAX_FAILED = 20;
const IP_WINDOW_MINUTES = 15;

export interface User {
  id: number;
  outletId: number;
  name: string;
  login: string;
  role: Role;
  lang: Lang;
  /** storage key of the profile photo (serve via avatarUrl), or null */
  avatar: string | null;
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
  const ip = await clientIp();
  if (!(await reserveIpTry(db, ip))) {
    await logLogin(null, loginName, "throttled");
    return { ok: false, error: tk("ใส่ PIN ผิดหลายครั้งจากเครือข่ายนี้ ลองใหม่ใน {n} นาที"), params: { n: IP_WINDOW_MINUTES } };
  }
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
    approval: "pending" | "rejected" | null;
    avatar_key: string | null;
  }>(`select * from users where login = $1`, [loginName.trim().toLowerCase()]);

  // One message for unknown name, wrong PIN and locked account, so a guesser can't tell which
  // usernames exist. The login form explains the lock itself after a couple of failed tries.
  const fail = { ok: false as const, error: tk("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง") };
  // Signed up on /signup but not approved yet (active = false): still checked, below.
  if (!u || (!u.active && u.approval !== "pending")) {
    await bcrypt.compare(pin, dummyHash()); // keep timing similar to a real check
    await logLogin(u?.id ?? null, loginName, "unknown");
    return fail;
  }
  if (!(await reservePinTry(db, u.id))) {
    await bcrypt.compare(pin, dummyHash());
    await logLogin(u.id, loginName, "locked");
    return fail;
  }
  if (!(await bcrypt.compare(pin, u.pin_hash))) {
    await logLogin(u.id, loginName, "bad_pin");
    return fail;
  }
  await clearPinTries(db, u.id);
  refundIpTry(ip);
  // Say "waiting for approval" only to someone who knows the PIN.
  if (u.approval === "pending") {
    await logLogin(u.id, loginName, "pending");
    return { ok: false, error: tk("บัญชีนี้รอ Admin อนุมัติ เข้าระบบได้หลังอนุมัติแล้ว") };
  }
  await db.query(`update users set last_seen_at = now() where id = $1`, [u.id]);
  await logLogin(u.id, loginName, null);

  await issueSession(u.id, u.session_version);
  await rememberLang(u.lang);
  return { ok: true, user: { id: u.id, outletId: u.outlet_id, name: u.name, login: u.login, role: u.role, lang: u.lang, avatar: u.avatar_key } };
}

/** Counts a PIN try against the account before the PIN is checked, in one UPDATE, so parallel
 * guesses can't all slip in under the limit. The 5th try sets the lock; a correct PIN clears it
 * (clearPinTries). After a lock runs out the count is not reset, so one more wrong PIN locks again.
 * Returns false while the account is locked. */
export async function reservePinTry(db: Db, userId: number): Promise<boolean> {
  const rows = await db.query(
    `update users set failed_attempts = failed_attempts + 1,
       locked_until = case when failed_attempts + 1 >= $2 then now() + make_interval(mins => $3) end
     where id = $1 and (locked_until is null or locked_until <= now())
     returning id`,
    [userId, MAX_FAILED, LOCK_MINUTES],
  );
  return rows.length > 0;
}

export async function clearPinTries(db: Db, userId: number) {
  await db.query(`update users set failed_attempts = 0, locked_until = null where id = $1`, [userId]);
}

/** Client address. On Vercel x-real-ip / x-forwarded-for are set by the platform, not the client. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim().slice(0, 64) || "unknown";
}

/** Counts a sign-in try against the IP up front (same reasoning as reservePinTry); a successful
 * sign-in gives it back, so only failures add up. False once the IP is over the limit. */
async function reserveIpTry(db: Db, ip: string): Promise<boolean> {
  const [r] = await db.query<{ failures: number }>(
    `insert into login_throttle as t (ip, failures) values ($1, 1)
     on conflict (ip) do update set
       window_start = case when t.window_start <= now() - make_interval(mins => $2) then now() else t.window_start end,
       failures = case when t.window_start <= now() - make_interval(mins => $2) then 1 else t.failures + 1 end
     returning failures`,
    [ip, IP_WINDOW_MINUTES],
  );
  return r.failures <= IP_MAX_FAILED;
}

function refundIpTry(ip: string) {
  after(async () => {
    try {
      const db = await getDb();
      await db.query(`update login_throttle set failures = greatest(failures - 1, 0) where ip = $1`, [ip]);
      await db.query(`delete from login_throttle where window_start < now() - interval '1 day'`);
    } catch (e) {
      console.error("login_throttle update failed", e);
    }
  });
}

/** Session cookie for this device. Bumping users.session_version signs out every other token. */
export async function issueSession(userId: number, sessionVersion: number) {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
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
}

/** For the usage page (/usage). Written after the response so a slow insert never delays sign-in. */
async function logLogin(userId: number | null, loginName: string, reason: "bad_pin" | "locked" | "unknown" | "pending" | "throttled" | null,
) {
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  after(async () => {
    try {
      const db = await getDb();
      await db.query(`insert into login_events (user_id, login, ok, reason, user_agent) values ($1, $2, $3, $4, $5)`, [
        userId,
        loginName.trim().toLowerCase().slice(0, 64),
        reason === null,
        reason,
        ua,
      ]);
    } catch (e) {
      console.error("login_events insert failed", e);
    }
  });
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
      avatar_key: string | null;
    }>(`select id, outlet_id, name, login, role, session_version, lang, avatar_key from users where id = $1 and active`, [
      Number(payload.sub),
    ]);
    if (!u || u.session_version !== payload.sv) return null;
    touchLastSeen(u.id);
    return { id: u.id, outletId: u.outlet_id, name: u.name, login: u.login, role: u.role, lang: u.lang, avatar: u.avatar_key };
  } catch {
    return null;
  }
});

/** users.last_seen_at for the usage page: at most one write per user per minute, after the response. */
function touchLastSeen(userId: number) {
  try {
    after(async () => {
      try {
        const db = await getDb();
        await db.query(
          `update users set last_seen_at = now()
           where id = $1 and (last_seen_at is null or last_seen_at < now() - interval '1 minute')`,
          [userId],
        );
      } catch (e) {
        console.error("last_seen_at update failed", e);
      }
    });
  } catch {
    // called outside a request (no after() scope): skip
  }
}

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
