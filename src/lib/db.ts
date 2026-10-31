// Database access. Production uses Postgres (Supabase) via DATABASE_URL;
// local development without DATABASE_URL uses PGlite (embedded Postgres in
// WASM) persisted to .data/pglite, so the same SQL runs in both.

import { migrations } from "./migrations";

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  tx<R>(fn: (db: Db) => Promise<R>): Promise<R>;
}

// numeric → number, bigint (count(*)) → number, date stays 'YYYY-MM-DD'
const NUMERIC = 1700;
const INT8 = 20;
const DATE = 1082;

async function createPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    onnotice: () => {}, // "already exists, skipping" etc. from migrations would fill the Vercel logs
    prepare: false, // Supabase transaction pooler does not support prepared statements
    // One query at a time per connection: pipelined queries through Supavisor's transaction
    // pooler stall (backend waits in ClientRead forever) and every signed-in page hangs.
    max_pipeline: 1,
    max: 5,
    types: {
      numeric: { to: NUMERIC, from: [NUMERIC], serialize: String, parse: Number },
      bigint: { to: INT8, from: [INT8], serialize: String, parse: Number },
      date: { to: DATE, from: [DATE], serialize: String, parse: (x: string) => x },
    },
  });
  type Tx = { unsafe: typeof sql.unsafe };
  const wrap = (s: Tx): Db => ({
    query: async <T>(text: string, params: unknown[] = []) =>
      (await s.unsafe(text, params as never[])) as unknown as T[],
    tx: (fn) => fn(wrap(s)), // already inside a transaction
  });
  return {
    ...wrap(sql),
    tx: (fn) => sql.begin((t) => fn(wrap(t as unknown as Tx))) as Promise<never>,
  };
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  const dir = process.env.PGLITE_DIR ?? `${process.cwd()}/.data/pglite`;
  mkdirSync(dirname(dir), { recursive: true });
  const pg = await PGlite.create(dir, {
    parsers: {
      [NUMERIC]: (v: string) => Number(v),
      [INT8]: (v: string) => Number(v),
      [DATE]: (v: string) => v,
    },
  });
  type Q = { query: typeof pg.query };
  const wrap = (q: Q): Db => ({
    query: async <T>(text: string, params: unknown[] = []) =>
      (await q.query<T>(text, params)).rows,
    tx: (fn) => fn(wrap(q)),
  });
  return { ...wrap(pg), tx: (fn) => pg.transaction((t) => fn(wrap(t))) };
}

async function migrate(db: Db) {
  await db.query(
    `create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`,
  );
  // Like every other table: no policies, so Supabase's public API can't read or change it
  await db.query(`alter table schema_migrations enable row level security`);
  const done = new Set(
    (await db.query<{ id: string }>(`select id from schema_migrations`)).map((r) => r.id),
  );
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await db.tx(async (tx) => {
      for (const stmt of splitSql(m.sql)) await tx.query(stmt);
      await tx.query(`insert into schema_migrations (id) values ($1)`, [m.id]);
    });
  }
}

// Split on semicolons outside $$ blocks so each statement can run with the
// extended protocol (both drivers reject multi-statement parameterised queries).
function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  for (const line of sql.split("\n")) {
    if (line.trim().startsWith("--")) continue;
    buf += line + "\n";
    const marks = line.match(/\$\$/g)?.length ?? 0;
    if (marks % 2 === 1) inDollar = !inDollar;
    if (!inDollar && line.trimEnd().endsWith(";")) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const db = url ? await createPostgres(url) : await createPglite();
  await migrate(db);
  const seedDemo = process.env.SEED_DEMO ? process.env.SEED_DEMO === "true" : !url;
  if (seedDemo) {
    const [{ n }] = await db.query<{ n: number }>(`select count(*) as n from outlets`);
    if (n === 0) {
      const { seedDemoData } = await import("./seed");
      await seedDemoData(db);
    }
  }
  return db;
}

const g = globalThis as unknown as { __sopDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__sopDb) {
    g.__sopDb = init().catch((e) => {
      g.__sopDb = undefined;
      throw e;
    });
  }
  return g.__sopDb;
}
