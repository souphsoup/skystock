// Demo data for local development and sales demos: MAI The Sky Bar with the
// Freezer list (31 รายการ, ตัวอย่าง — แทนด้วยใบนับจริงของร้านผ่าน scripts/import-items.ts)
// and 7 days of approved counts so the dashboard has something to show.

import bcrypt from "bcryptjs";
import type { Db } from "./db";
import { addDays, businessDate } from "./dates";

type SeedItem = [nameTh: string, nameEn: string, unit: string, par: number, cost: number, blind?: boolean];

// [หมวด, ชนิด | null, ส่วน | null, items]
const FREEZER: [string, string | null, string | null, SeedItem[]][] = [
  ["เนื้อสัตว์", "หมู", "ไม้เสียบ", [["หมูเสียบไม้", "Pork skewer", "ไม้", 60, 18]]],
  ["เนื้อสัตว์", "หมู", null, [
    ["หมูสามชั้น", "Pork belly", "แพ็ก", 4, 220],
    ["แฮมอิเบริโก", "Iberico ham", "แพ็ก", 3, 650, true],
  ]],
  ["เนื้อสัตว์", "ไก่", "ไม้เสียบ", [["ไก่เสียบไม้", "Chicken skewer", "ไม้", 40, 15]]],
  ["เนื้อสัตว์", "เนื้อวัว", "Wagyu", [
    ["เนื้อวากิว ริบอาย", "Beef wagyu", "แพ็ก", 6, 1450, true],
    ["เนื้อวากิว ใบพาย", "Wagyu flat iron", "แพ็ก", 4, 980, true],
  ]],
  ["เนื้อสัตว์", "เนื้อวัว", "เนื้อไทย", [["เนื้อฉีก", "Shredded beef", "ถุง", 3, 260]]],
  ["เนื้อสัตว์", "แกะ", null, [["แลมบ์แร็ค", "Lamb", "แพ็ก", 4, 890]]],
  ["อาหารทะเล", null, null, [
    ["ทูน่า", "Tuna", "แพ็ก", 20, 180],
    ["ปลาหมึก", "Calamari", "แพ็ก", 15, 95],
    ["กุ้ง", "Prawn", "แพ็ก", 10, 320],
    ["แซลมอน", "Salmon", "แพ็ก", 6, 420],
    ["หอยเชลล์", "Scallop", "แพ็ก", 4, 380],
    ["ปูนิ่ม", "Soft shell crab", "แพ็ก", 4, 290],
  ]],
  ["ซอสและของเตรียม", null, null, [
    ["อาลิโอลี่", "Aioli", "กระปุก", 3, 120],
    ["กรีนออยล์", "Green oil", "ขวด", 2, 90],
    ["น้ำอาจาด", "Ajad sauce", "กระปุก", 2, 45],
    ["น้ำข้าวซอย", "Khao soi broth", "ถุง", 4, 110],
    ["ซอสบาร์บีคิว", "BBQ sauce", "ขวด", 2, 85],
    ["ทรัฟเฟิลมาโย", "Truffle mayo", "กระปุก", 2, 180],
    ["ศรีราชามาโย", "Sriracha mayo", "กระปุก", 2, 70],
    ["น้ำจิ้มแจ่ว", "Nam jim jaew", "กระปุก", 2, 40],
    ["ซอสเทริยากิ", "Teriyaki sauce", "ขวด", 2, 95],
    ["เพสโต้", "Pesto", "กระปุก", 2, 150],
    ["ซัลซ่ามะเขือเทศ", "Tomato salsa", "กระปุก", 2, 60],
    ["เนยกระเทียม", "Garlic butter", "ก้อน", 3, 75],
    ["แป้งพิซซ่า", "Pizza dough", "ก้อน", 10, 25],
  ]],
  ["ผักผลไม้และชีส", null, null, [
    ["อะโวคาโด", "Avocado", "ลูก", 6, 55],
    ["ครีมชีส", "Cream cheese", "ก้อน", 3, 160],
    ["มอสซาเรลล่า", "Mozzarella", "ถุง", 3, 210],
    ["เฟรนช์ฟราย", "French fries", "ถุง", 6, 140],
  ]],
];

const LOCATIONS: [code: string, name: string][] = [
  ["freezer", "Freezer"],
  ["chiller", "Chiller"],
  ["dry", "คลังแห้ง"],
  ["bar22", "บาร์ชั้น 22"],
  ["bar24", "บาร์ชั้น 24"],
];

export const DEMO_USERS: [login: string, name: string, role: string, pin: string][] = [
  ["ton", "ต้น", "operation", "111111"],
  ["ploy", "พลอย", "operation", "222222"],
  ["chef", "เชฟชัย", "supervisor", "333333"],
  ["napa", "คุณนภา", "manager", "444444"],
  ["admin", "Admin", "admin", "999999"],
];

// Small deterministic PRNG so every fresh demo DB looks the same.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function seedDemoData(db: Db) {
  await db.tx(async (tx) => {
    const [{ id: outletId }] = await tx.query<{ id: number }>(
      `insert into outlets (name) values ('MAI The Sky Bar') returning id`,
    );

    const locIds: Record<string, number> = {};
    for (const [i, [code, name]] of LOCATIONS.entries()) {
      const [r] = await tx.query<{ id: number }>(
        `insert into locations (outlet_id, code, name, sort_order) values ($1,$2,$3,$4) returning id`,
        [outletId, code, name, i],
      );
      locIds[code] = r.id;
    }

    const catIds = new Map<string, number>();
    async function category(path: string[]): Promise<number> {
      const key = path.join(" › ");
      const found = catIds.get(key);
      if (found) return found;
      const parent = path.length > 1 ? await category(path.slice(0, -1)) : null;
      const [r] = await tx.query<{ id: number }>(
        `insert into categories (outlet_id, parent_id, name, level, sort_order) values ($1,$2,$3,$4,$5) returning id`,
        [outletId, parent, path[path.length - 1], path.length, catIds.size],
      );
      catIds.set(key, r.id);
      return r.id;
    }

    const items: { id: number; nameEn: string; par: number; blind: boolean }[] = [];
    let sort = 0;
    for (const [top, kind, part, list] of FREEZER) {
      const catId = await category([top, kind, part].filter((x): x is string => !!x));
      for (const [nameTh, nameEn, unit, par, cost, blind = false] of list) {
        const [r] = await tx.query<{ id: number }>(
          `insert into items (outlet_id, category_id, location_id, name_th, name_en, unit, unit_cost, par, blind, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
          [outletId, catId, locIds.freezer, nameTh, nameEn, unit, cost, par, blind, sort++],
        );
        items.push({ id: r.id, nameEn, par, blind });
      }
    }

    const userIds: Record<string, number> = {};
    for (const [login, name, role, pin] of DEMO_USERS) {
      const [r] = await tx.query<{ id: number }>(
        `insert into users (outlet_id, login, name, role, pin_hash) values ($1,$2,$3,$4,$5) returning id`,
        [outletId, login, name, role, bcrypt.hashSync(pin, 10)],
      );
      userIds[login] = r.id;
    }

    // Today, before the count: a delivery came in and something went off. These
    // movements wait unassigned and feed today's Freezer count when it is opened.
    const itemByEn = new Map(items.map((i) => [i.nameEn, i.id]));
    const demoMoves: [kind: string, minutesAgo: number, by: string, extra: Record<string, string>, lines: [string, number][]][] = [
      ["receive", 50, "ploy", { supplier: "Makro" }, [["Pork skewer", 60], ["Prawn", 10]]],
      ["waste", 20, "ton", { reason: "expired" }, [["Salmon", 1]]],
    ];
    for (const [kind, ago, by, extra, lines] of demoMoves) {
      const [m] = await tx.query<{ id: number }>(
        `insert into movements (outlet_id, kind, supplier, reason, from_location_id, to_location_id, recorded_at, created_by)
         values ($1,$2,$3,$4,$5,$6, now() - make_interval(mins => $7), $8) returning id`,
        [outletId, kind, extra.supplier ?? null, extra.reason ?? null,
          kind === "receive" ? null : locIds.freezer, kind === "receive" ? locIds.freezer : null, ago, userIds[by]],
      );
      for (const [name, qty] of lines) {
        await tx.query(`insert into movement_lines (movement_id, item_id, direction, qty) values ($1,$2,$3,$4)`, [
          m.id, itemByEn.get(name), kind === "receive" ? "in" : "out", qty,
        ]);
      }
    }

    // 7 approved days before today. Day 0 is the baseline count (no opening).
    const rand = rng(42);
    const today = businessDate();
    const stock = new Map<number, number>();
    const DAYS = 7;
    for (let d = DAYS; d >= 1; d--) {
      const date = addDays(today, -d);
      const counter = d % 2 ? userIds.ton : userIds.ploy;
      const [c] = await tx.query<{ id: number }>(
        `insert into counts (location_id, business_date, status, submitted_by, submitted_at, approved_by, approved_at)
         values ($1,$2,'approved',$3,($2::date + time '16:10') at time zone 'Asia/Bangkok',$4,($2::date + time '16:40') at time zone 'Asia/Bangkok')
         returning id`,
        [locIds.freezer, date, counter, userIds.chef],
      );
      for (const it of items) {
        const prev = stock.get(it.id);
        let opening: number | null = null;
        let inQty = 0;
        let outQty = 0;
        let counted: number;
        if (prev === undefined) {
          counted = Math.round(it.par * (1.5 + rand()));
        } else {
          opening = prev;
          const restock = prev < it.par && it.nameEn !== "Lamb";
          if (restock) inQty = Math.round(it.par * 1.5 + rand() * it.par);
          outQty = Math.min(opening + inQty, Math.round(it.par * (0.2 + rand() * 0.4)));
          if (it.nameEn === "Lamb") outQty = Math.min(opening, d <= 2 ? opening : 1);
          if (it.nameEn === "Avocado" && d === 1) outQty = Math.max(0, opening + inQty - 1);
          counted = opening + inQty - outQty;
          // A little shrinkage on blind (high-value) items so variance shows up.
          if (it.blind && rand() < 0.25 && counted > 0) counted -= 1;
        }
        await tx.query(
          `insert into count_lines (count_id, item_id, business_date, opening, in_qty, out_qty, counted, status, counted_by)
           values ($1,$2,$8,$3,$4,$5,$6,'confirmed',$7)`,
          [c.id, it.id, opening, inQty, outQty, counted, counter, date],
        );
        stock.set(it.id, counted);
      }
    }
  });
}
