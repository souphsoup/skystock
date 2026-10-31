import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendDigest } from "@/lib/notify";

// Called by Vercel Cron (vercel.json, 01:00 UTC = 08:00 น.) with "Authorization: Bearer $CRON_SECRET".
// Any other scheduler can call it the same way. Sends once per outlet per business date.

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  const outlets = await db.query<{ id: number }>(`select id from outlets order by id`);
  const out = [];
  for (const o of outlets) {
    try {
      const r = await sendDigest(o.id, { kind: "morning" });
      out.push({ outletId: o.id, status: r.status, sent: r.results.filter((x) => x.ok).length, failed: r.results.filter((x) => !x.ok).length });
    } catch (e) {
      console.error("[cron:morning]", o.id, e);
      out.push({ outletId: o.id, status: "error" });
    }
  }
  return NextResponse.json({ outlets: out });
}
