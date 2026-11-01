import "server-only";
import { getDb } from "./db";
import type { User } from "./session";
import type { CountStatus, Role } from "./types";

// App usage for one business date (06:00 → 06:00 Bangkok, see dates.ts): who signed in,
// who counted what, and how far each location got. Admin only (/usage).

/** start of business date $2 as timestamptz; the window is [t0, t0 + 1 day) */
const T0 = `(($2::date + time '06:00') at time zone 'Asia/Bangkok')`;
const IN_DAY = (col: string) => `${col} >= ${T0} and ${col} < ${T0} + interval '1 day'`;

const REVIEW_ACTIONS = [
  "count.approve",
  "count.approve_matched",
  "count.recount_matched",
  "line.confirm",
  "line.request_recount",
  "line.adjust",
  "proposal.approve",
  "proposal.reject",
];

export interface UsageUser {
  id: number;
  name: string;
  login: string;
  role: Role;
  /** last request, or the last thing they recorded (before last_seen_at existed) */
  lastActiveAt: Date | null;
  /** active in the last 5 minutes */
  online: boolean;
  lastLoginAt: Date | null;
  device: string | null;
  lockedUntil: Date | null;
  logins: number;
  failed: number;
  lines: number;
  submits: number;
  movements: number;
  proposals: number;
  reviews: number;
}

export interface UsageLocation {
  id: number;
  name: string;
  status: CountStatus | null;
  total: number;
  counted: number;
  submittedAt: Date | null;
  submittedBy: string | null;
}

export interface FailedLogin {
  at: Date;
  login: string;
  name: string | null;
  reason: "bad_pin" | "locked" | "unknown" | "pending" | "throttled";
}

export interface Usage {
  users: UsageUser[];
  locations: UsageLocation[];
  /** events per hour, index 0 = 06:00 … 23 = 05:00 next morning */
  hours: number[];
  failed: FailedLogin[];
  asOf: Date;
}

const ONLINE_MS = 5 * 60_000;

export async function usage(user: User, date: string): Promise<Usage> {
  const db = await getDb();
  const asOf = new Date();
  const [users, locations, hours, failed] = await Promise.all([
    db.query<{
      id: number;
      name: string;
      login: string;
      role: Role;
      last_active_at: Date | null;
      last_login_at: Date | null;
      user_agent: string | null;
      locked_until: Date | null;
      logins: number;
      failed: number;
      lines: number;
      submits: number;
      movements: number;
      proposals: number;
      reviews: number;
    }>(
      `select u.id, u.name, u.login, u.role, u.locked_until,
              greatest(u.last_seen_at,
                       (select max(a.at) from audit_log a where a.user_id = u.id),
                       (select max(l.updated_at) from count_lines l where l.counted_by = u.id)) as last_active_at,
              ll.at as last_login_at, ll.user_agent,
              (select count(*) from login_events e where e.user_id = u.id and e.ok and ${IN_DAY("e.at")}) as logins,
              (select count(*) from login_events e where e.user_id = u.id and not e.ok and ${IN_DAY("e.at")}) as failed,
              (select count(*) from count_lines l
                where l.counted_by = u.id and l.counted is not null and ${IN_DAY("l.updated_at")}) as lines,
              (select count(*) from audit_log a
                where a.user_id = u.id and a.action in ('count.submit', 'count.resubmit') and ${IN_DAY("a.at")}) as submits,
              (select count(*) from movements m where m.created_by = u.id and ${IN_DAY("m.created_at")}) as movements,
              (select count(*) from item_proposals p where p.created_by = u.id and ${IN_DAY("p.created_at")}) as proposals,
              (select count(*) from audit_log a
                where a.user_id = u.id and a.action = any($3::text[]) and ${IN_DAY("a.at")}) as reviews
       from users u
       left join lateral (
         select e.at, e.user_agent from login_events e where e.user_id = u.id and e.ok order by e.at desc limit 1
       ) ll on true
       where u.outlet_id = $1 and u.active
       order by last_active_at desc nulls last, u.name`,
      [user.outletId, date, REVIEW_ACTIONS],
    ),
    db.query<{
      id: number;
      name: string;
      status: CountStatus | null;
      total: number;
      counted: number;
      submitted_at: Date | null;
      submitted_by: string | null;
    }>(
      `select loc.id, loc.name, c.status, c.submitted_at, su.name as submitted_by,
              greatest((select count(*) from count_lines l where l.count_id = c.id),
                       (select count(*) from items i where i.location_id = loc.id and i.active)) as total,
              (select count(*) from count_lines l where l.count_id = c.id and l.counted is not null) as counted
       from locations loc
       left join counts c on c.location_id = loc.id and c.business_date = $2
       left join users su on su.id = c.submitted_by
       where loc.outlet_id = $1 and loc.active
       order by loc.sort_order, loc.id`,
      [user.outletId, date],
    ),
    // Every recorded thing counts as one event: sign-ins, saved count lines, and audit_log
    // (submit, approve, receive/issue/transfer/waste, proposals, settings changes).
    db.query<{ h: number; n: number }>(
      `with ev as (
         select e.at from login_events e join users u on u.id = e.user_id
          where u.outlet_id = $1 and e.ok and ${IN_DAY("e.at")}
         union all
         select l.updated_at from count_lines l join counts c on c.id = l.count_id
          join locations loc on loc.id = c.location_id
          where loc.outlet_id = $1 and l.counted_by is not null and ${IN_DAY("l.updated_at")}
         union all
         select a.at from audit_log a join users u on u.id = a.user_id
          where u.outlet_id = $1 and ${IN_DAY("a.at")}
       )
       select floor(extract(epoch from (at - ${T0})) / 3600)::int as h, count(*) as n from ev group by 1`,
      [user.outletId, date],
    ),
    db.query<{ at: Date; login: string; name: string | null; reason: FailedLogin["reason"] }>(
      `select e.at, e.login, u.name, e.reason
       from login_events e left join users u on u.id = e.user_id
       where not e.ok and (u.outlet_id = $1 or e.user_id is null) and ${IN_DAY("e.at")}
       order by e.at desc limit 50`,
      [user.outletId, date],
    ),
  ]);

  const perHour = Array<number>(24).fill(0);
  for (const r of hours) if (r.h >= 0 && r.h < 24) perHour[r.h] += r.n;

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      login: u.login,
      role: u.role,
      lastActiveAt: u.last_active_at,
      online: !!u.last_active_at && +asOf - +new Date(u.last_active_at) < ONLINE_MS,
      lastLoginAt: u.last_login_at,
      device: deviceOf(u.user_agent),
      lockedUntil: u.locked_until && new Date(u.locked_until) > asOf ? u.locked_until : null,
      logins: u.logins,
      failed: u.failed,
      lines: u.lines,
      submits: u.submits,
      movements: u.movements,
      proposals: u.proposals,
      reviews: u.reviews,
    })),
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status,
      total: l.total,
      counted: l.counted,
      submittedAt: l.submitted_at,
      submittedBy: l.submitted_by,
    })),
    hours: perHour,
    failed,
    asOf,
  };
}

function deviceOf(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android" : "Android tablet";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return null;
}
