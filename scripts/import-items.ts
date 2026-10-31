// นำเข้ารายการสินค้าจาก CSV (ใบนับเดิมของร้าน)
//   npx tsx scripts/import-items.ts items.csv
// คอลัมน์: location,category,name_th,name_en,unit,par,unit_cost,blind
//   location  = รหัสจุดเก็บ เช่น freezer, chiller, dry, bar22, bar24
//   category  = หมวด > ชนิด > ส่วน (สูงสุด 3 ชั้น) เช่น "เนื้อสัตว์ > หมู"
//   blind     = y เพื่อเปิด Blind count
// ลำดับแถวในไฟล์ = ลำดับในหน้านับ. รายการชื่อซ้ำ (name_th + จุดเก็บ) จะอัปเดตแทนการเพิ่มใหม่.
// Local (PGlite): หยุด dev server ก่อนรัน. Production: ตั้ง DATABASE_URL.

import { readFileSync } from "node:fs";
import { getDb } from "../src/lib/db";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx scripts/import-items.ts items.csv");
  const [header, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const col = (name: string) => {
    const i = header.findIndex((h) => h.trim().toLowerCase() === name);
    if (i < 0 && ["location", "name_th", "unit"].includes(name)) throw new Error(`missing column: ${name}`);
    return i;
  };
  const c = Object.fromEntries(
    ["location", "category", "name_th", "name_en", "unit", "par", "unit_cost", "blind"].map((n) => [n, col(n)]),
  );
  const get = (r: string[], n: string) => (c[n] >= 0 ? (r[c[n]] ?? "").trim() : "");

  const db = await getDb();
  const [outlet] = await db.query<{ id: number }>(`select id from outlets order by id limit 1`);
  if (!outlet) throw new Error("no outlet yet: run scripts/create-user.ts first");

  let added = 0;
  let updated = 0;
  await db.tx(async (tx) => {
    const catCache = new Map<string, number>();
    async function category(path: string[]): Promise<number | null> {
      if (!path.length) return null;
      const key = path.join(" > ");
      if (catCache.has(key)) return catCache.get(key)!;
      const parent = await category(path.slice(0, -1));
      const name = path[path.length - 1];
      let [row] = await tx.query<{ id: number }>(
        `select id from categories where outlet_id = $1 and name = $2 and parent_id is not distinct from $3`,
        [outlet.id, name, parent],
      );
      if (!row) {
        [row] = await tx.query<{ id: number }>(
          `insert into categories (outlet_id, parent_id, name, level) values ($1,$2,$3,$4) returning id`,
          [outlet.id, parent, name, path.length],
        );
      }
      catCache.set(key, row.id);
      return row.id;
    }

    for (const [i, r] of rows.entries()) {
      const code = get(r, "location").toLowerCase();
      const [loc] = await tx.query<{ id: number }>(`select id from locations where outlet_id = $1 and code = $2`, [outlet.id, code]);
      if (!loc) throw new Error(`row ${i + 2}: unknown location "${code}"`);
      const path = get(r, "category").split(">").map((s) => s.trim()).filter(Boolean);
      if (path.length > 3) throw new Error(`row ${i + 2}: category deeper than 3 levels`);
      const catId = await category(path);
      const vals = [
        catId,
        get(r, "name_en"),
        get(r, "unit"),
        Number(get(r, "par") || 0),
        Number(get(r, "unit_cost") || 0),
        /^(y|yes|true|1)$/i.test(get(r, "blind")),
        i,
      ];
      const nameTh = get(r, "name_th");
      if (!nameTh || !get(r, "unit")) throw new Error(`row ${i + 2}: name_th and unit are required`);
      const upd = await tx.query(
        `update items set category_id = $3, name_en = $4, unit = $5, par = $6, unit_cost = $7, blind = $8, sort_order = $9, active = true
         where location_id = $1 and name_th = $2 returning id`,
        [loc.id, nameTh, ...vals],
      );
      if (upd.length) updated++;
      else {
        await tx.query(
          `insert into items (outlet_id, location_id, name_th, category_id, name_en, unit, par, unit_cost, blind, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [outlet.id, loc.id, nameTh, ...vals],
        );
        added++;
      }
    }
  });
  console.log(`imported: ${added} added, ${updated} updated`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
