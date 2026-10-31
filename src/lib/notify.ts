import "server-only";
import { getDb, type Db } from "./db";
import { HttpError, type User } from "./session";
import { audit, overview, stockAlerts, todayTasks } from "./stock";
import { wasteValue } from "./movements";
import { addDays, businessDate, fmtWeekday } from "./dates";
import { toEmail, toFlex, type Digest, type DigestRow } from "./digest";
import { LINE_ID, lineConfigured, pushLine, type LineSource, sourceId } from "./line";
import { fmtBaht, fmtQty, fmtSigned } from "@/components/status";
import type { RunStatus } from "./notify-labels";

export type Channel = "line" | "email";

const MAX_PAR_ROWS = 8;
const MAX_VARIANCE_ROWS = 5;

export function appUrl(): string | null {
  const url =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return url ? url.replace(/\/+$/, "") : null;
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

/** The morning job and the LINE webhook have no logged-in user; reports only need the outlet. */
const systemUser = (outletId: number): User => ({ id: 0, outletId, name: "system", login: "system", role: "admin", lang: "th" });

// ---------------------------------------------------------------- build

export async function buildDigest(outletId: number, date = addDays(businessDate(), -1)): Promise<Digest> {
  const db = await getDb();
  const sys = systemUser(outletId);
  const [[outlet], tasks, ov, alerts, waste, [{ receipts }]] = await Promise.all([
    db.query<{ name: string }>(`select name from outlets where id = $1`, [outletId]),
    todayTasks(sys, date),
    overview(sys, date, date),
    stockAlerts(sys),
    wasteValue(sys, date, date),
    db.query<{ receipts: number }>(
      `select count(*) as receipts from movements
       where outlet_id = $1 and kind = 'receive' and voided_at is null
         and ((recorded_at at time zone 'Asia/Bangkok') - interval '6 hours')::date = $2`,
      [outletId, date],
    ),
  ]);

  const status: Digest["status"] = [];
  const missing = tasks.filter((t) => !t.status || t.status === "draft").map((t) => t.locationName);
  const waiting = tasks.filter((t) => t.status === "submitted" || t.status === "recount").map((t) => t.locationName);
  if (missing.length) status.push({ text: `ยังไม่ส่งยอด: ${missing.join(", ")}`, tone: "bad" });
  if (waiting.length) status.push({ text: `รอหัวหน้าอนุมัติ: ${waiting.join(", ")}`, tone: "warn" });
  if (!tasks.length) status.push({ text: "ยังไม่มีจุดนับที่มีรายการ", tone: "muted" });
  else if (!missing.length && !waiting.length) status.push({ text: `นับและอนุมัติครบ ${tasks.length} จุด ✓`, tone: "ok" });

  const varianceValue = Math.round(ov.variances.reduce((s, v) => s + v.value, 0));
  const stats: Digest["stats"] = [
    { label: "มูลค่าคงคลัง", value: fmtBaht(ov.inventoryValue) },
    { label: "ส่วนต่าง", value: fmtBaht(varianceValue), tone: varianceValue < 0 ? "bad" : undefined },
    { label: "ของเสีย", value: fmtBaht(waste), tone: waste > 0 ? "bad" : undefined },
  ];

  const sections: Digest["sections"] = [];
  if (alerts.length) {
    sections.push({
      title: `ต่ำกว่า Par · ต้องสั่ง (${alerts.length})`,
      rows: alerts.slice(0, MAX_PAR_ROWS).map(
        (a): DigestRow => ({
          left: `${a.name} · ${a.locationName}`,
          right: a.level === "out" ? "หมด" : `เหลือ ${fmtQty(a.counted)} / ${fmtQty(a.par)} ${a.unit}`,
          tone: a.level === "out" ? "bad" : "warn",
        }),
      ),
      more: Math.max(0, alerts.length - MAX_PAR_ROWS),
    });
  }
  if (ov.variances.length) {
    sections.push({
      title: "ส่วนต่างที่ต้องดู",
      rows: ov.variances.slice(0, MAX_VARIANCE_ROWS).map((v) => ({
        left: `${v.name} · ${v.locationName}`,
        right: `${fmtSigned(v.variance)} ${v.unit} (${fmtBaht(v.value)})`,
        tone: v.variance < 0 ? "bad" : "warn",
      })),
      more: Math.max(0, ov.variances.length - MAX_VARIANCE_ROWS),
    });
  }
  if (receipts > 0) {
    sections.push({ title: "รับของเข้า", rows: [{ left: "ใบส่งของที่บันทึก", right: `${receipts} ใบ` }], more: 0 });
  }

  const base = appUrl();
  const day = fmtWeekday(date);
  return {
    date,
    title: "สรุปสต๊อกเมื่อวาน",
    subtitle: `${outlet?.name ?? "SOP-Stock"} · ${day}`,
    status,
    stats,
    sections,
    url: base ? `${base}/dashboard?period=week` : null,
    altText: [`สรุปสต๊อก ${day}`, status[0]?.text, alerts.length ? `ต่ำกว่า Par ${alerts.length} รายการ` : null]
      .filter(Boolean)
      .join(" · "),
  };
}

// ---------------------------------------------------------------- recipients

export interface Target {
  id: number;
  channel: Channel;
  address: string;
  label: string;
  active: boolean;
  createdAt: string;
}

export async function listTargets(user: User): Promise<Target[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    channel: Channel;
    address: string;
    label: string;
    active: boolean;
    created_at: Date;
  }>(
    `select id, channel, address, label, active, created_at from notify_targets
     where outlet_id = $1 order by channel, created_at`,
    [user.outletId],
  );
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    address: r.address,
    label: r.label,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;

export async function addTarget(user: User, channel: Channel, rawAddress: unknown, rawLabel: unknown): Promise<number> {
  const address = typeof rawAddress === "string" ? rawAddress.trim() : "";
  const label = typeof rawLabel === "string" ? rawLabel.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  if (channel === "email" && !EMAIL.test(address)) throw new HttpError(400, "อีเมลไม่ถูกต้อง");
  if (channel === "line" && !LINE_ID.test(address)) {
    throw new HttpError(400, "LINE ID ต้องขึ้นต้นด้วย U, C หรือ R ตามด้วยตัวอักษร 32 ตัว");
  }
  const db = await getDb();
  return db.tx(async (tx) => {
    const [dup] = await tx.query(`select 1 from notify_targets where outlet_id = $1 and channel = $2 and lower(address) = lower($3)`, [
      user.outletId,
      channel,
      address,
    ]);
    if (dup) throw new HttpError(409, "มีผู้รับนี้อยู่แล้ว");
    const [r] = await tx.query<{ id: number }>(
      `insert into notify_targets (outlet_id, channel, address, label, active) values ($1,$2,$3,$4,true) returning id`,
      [user.outletId, channel, address, label],
    );
    await audit(tx, user.id, "notify.add", "notify_target", r.id, null, { channel, address, label });
    return r.id;
  });
}

async function ownTarget(db: Db, user: User, id: number) {
  const [t] = await db.query<{ id: number; outlet_id: number; channel: Channel; address: string; label: string; active: boolean }>(
    `select id, outlet_id, channel, address, label, active from notify_targets where id = $1`,
    [id],
  );
  if (!t || t.outlet_id !== user.outletId) throw new HttpError(404, "ไม่พบผู้รับนี้");
  return t;
}

export async function setTargetActive(user: User, id: number, active: boolean) {
  const db = await getDb();
  await db.tx(async (tx) => {
    const t = await ownTarget(tx, user, id);
    await tx.query(`update notify_targets set active = $2 where id = $1`, [id, !!active]);
    await audit(tx, user.id, "notify.active", "notify_target", id, { active: t.active }, { active: !!active });
  });
}

export async function removeTarget(user: User, id: number) {
  const db = await getDb();
  await db.tx(async (tx) => {
    const t = await ownTarget(tx, user, id);
    await tx.query(`delete from notify_targets where id = $1`, [id]);
    await audit(tx, user.id, "notify.remove", "notify_target", id, t, null);
  });
}

/** Single-outlet deployments: the outlet the LINE bot belongs to. */
export async function lineOutletId(): Promise<number | null> {
  const fromEnv = Number(process.env.LINE_OUTLET_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  const db = await getDb();
  const [o] = await db.query<{ id: number }>(`select id from outlets order by id limit 1`);
  return o?.id ?? null;
}

/** Bot added to a group / followed by a user: register it switched off until Admin turns it on. */
export async function registerLineSource(
  outletId: number,
  source: LineSource,
  label: () => Promise<string>,
): Promise<boolean> {
  const address = sourceId(source);
  if (!address) return false;
  const db = await getDb();
  const [known] = await db.query(`select 1 from notify_targets where outlet_id = $1 and channel = 'line' and address = $2`, [
    outletId,
    address,
  ]);
  if (known) return false;
  const name = await label();
  const rows = await db.query<{ id: number }>(
    `insert into notify_targets (outlet_id, channel, address, label, active) values ($1,'line',$2,$3,false)
     on conflict (outlet_id, channel, address) do nothing returning id`,
    [outletId, address, name.slice(0, 60)],
  );
  return rows.length > 0;
}

export async function deactivateLineSource(outletId: number, source: LineSource) {
  const address = sourceId(source);
  if (!address) return;
  const db = await getDb();
  await db.query(`update notify_targets set active = false where outlet_id = $1 and channel = 'line' and address = $2`, [
    outletId,
    address,
  ]);
}

// ---------------------------------------------------------------- send

export interface SendResult {
  targetId: number;
  label: string;
  channel: Channel;
  ok: boolean;
  dryRun: boolean;
  error?: string;
}


async function sendEmail(to: string, mail: { subject: string; html: string; text: string }) {
  const res = await fetch(`${process.env.RESEND_API_BASE || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], ...mail }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

/**
 * kind "morning": the scheduled summary, at most once per outlet and business date
 * (a failed or dry run may be retried). kind "test": sent from the settings page,
 * optionally to one recipient even if it is switched off.
 */
export async function sendDigest(
  outletId: number,
  opts: { kind: "morning" | "test"; date?: string; targetId?: number; userId?: number },
): Promise<{ status: RunStatus | "skipped"; results: SendResult[] }> {
  const db = await getDb();
  const date = opts.date ?? addDays(businessDate(), -1);

  let runId: number;
  if (opts.kind === "morning") {
    const claimed = await db.query<{ id: number }>(
      `insert into notify_runs (outlet_id, kind, business_date, status) values ($1,'morning',$2,'sending')
       on conflict (outlet_id, business_date) where kind = 'morning' do update
         set status = 'sending', results = null, created_at = now()
         where notify_runs.status in ('failed','dry_run','no_targets')
            or (notify_runs.status = 'sending' and notify_runs.created_at < now() - interval '10 minutes')
       returning id`,
      [outletId, date],
    );
    if (!claimed.length) return { status: "skipped", results: [] };
    runId = claimed[0].id;
  } else {
    const [r] = await db.query<{ id: number }>(
      `insert into notify_runs (outlet_id, kind, business_date, status, created_by) values ($1,'test',$2,'sending',$3) returning id`,
      [outletId, date, opts.userId ?? null],
    );
    runId = r.id;
  }

  const targets = await db.query<{ id: number; channel: Channel; address: string; label: string }>(
    opts.targetId
      ? `select id, channel, address, label from notify_targets where outlet_id = $1 and id = $2`
      : `select id, channel, address, label from notify_targets where outlet_id = $1 and active order by id`,
    opts.targetId ? [outletId, opts.targetId] : [outletId],
  );

  const results: SendResult[] = [];
  if (targets.length) {
    const digest = await buildDigest(outletId, date);
    const flex = toFlex(digest);
    const mail = toEmail(digest);
    for (const t of targets) {
      const base = { targetId: t.id, label: t.label || t.address, channel: t.channel };
      const live = t.channel === "line" ? lineConfigured() : emailConfigured();
      try {
        if (!live) {
          console.info(`[notify:dry-run] ${t.channel} → ${t.address}\n${mail.text}`);
        } else if (t.channel === "line") {
          await pushLine(t.address, [flex]);
        } else {
          await sendEmail(t.address, mail);
        }
        results.push({ ...base, ok: true, dryRun: !live });
      } catch (e) {
        console.error(`[notify] ${t.channel} → ${t.address}`, e);
        results.push({ ...base, ok: false, dryRun: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const ok = results.filter((r) => r.ok);
  const status: RunStatus = !results.length
    ? "no_targets"
    : ok.length && ok.every((r) => r.dryRun)
      ? "dry_run"
      : ok.length === results.length
        ? "sent"
        : ok.length
          ? "partial"
          : "failed";
  await db.query(`update notify_runs set status = $2, results = $3 where id = $1`, [runId, status, JSON.stringify(results)]);
  return { status, results };
}

export interface RunRow {
  id: number;
  kind: "morning" | "test";
  date: string;
  status: RunStatus;
  results: SendResult[];
  createdAt: string;
  by: string | null;
}

export async function listRuns(user: User, limit = 10): Promise<RunRow[]> {
  const db = await getDb();
  const rows = await db.query<{
    id: number;
    kind: "morning" | "test";
    business_date: string;
    status: RunStatus;
    results: SendResult[] | string | null;
    created_at: Date;
    by_name: string | null;
  }>(
    `select r.id, r.kind, r.business_date, r.status, r.results, r.created_at, u.name as by_name
     from notify_runs r left join users u on u.id = r.created_by
     where r.outlet_id = $1 order by r.created_at desc limit $2`,
    [user.outletId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    date: r.business_date,
    status: r.status,
    results: typeof r.results === "string" ? JSON.parse(r.results) : (r.results ?? []),
    createdAt: new Date(r.created_at).toISOString(),
    by: r.by_name,
  }));
}
