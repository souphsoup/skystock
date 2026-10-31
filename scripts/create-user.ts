// สร้างผู้ใช้ (และสร้าง outlet + จุดเก็บตั้งต้นถ้ายังไม่มี) สำหรับ Production
//   npx tsx scripts/create-user.ts <login> "<ชื่อ>" <operation|supervisor|manager|admin> <PIN 6 หลัก>
// รันซ้ำด้วย login เดิม = เปลี่ยน PIN/บทบาท และตัด session เดิมทุกเครื่อง

import bcrypt from "bcryptjs";
import { getDb } from "../src/lib/db";

const LOCATIONS: [string, string][] = [
  ["freezer", "Freezer"],
  ["chiller", "Chiller"],
  ["dry", "คลังแห้ง"],
  ["bar22", "บาร์ชั้น 22"],
  ["bar24", "บาร์ชั้น 24"],
];

async function main() {
  const [login, name, role, pin] = process.argv.slice(2);
  if (!login || !name || !["operation", "supervisor", "manager", "admin"].includes(role) || !/^\d{6}$/.test(pin ?? "")) {
    throw new Error('usage: tsx scripts/create-user.ts <login> "<name>" <role> <6-digit PIN>');
  }
  const db = await getDb();
  let [outlet] = await db.query<{ id: number }>(`select id from outlets order by id limit 1`);
  if (!outlet) {
    [outlet] = await db.query<{ id: number }>(`insert into outlets (name) values ('MAI The Sky Bar') returning id`);
    for (const [i, [code, locName]] of LOCATIONS.entries()) {
      await db.query(`insert into locations (outlet_id, code, name, sort_order) values ($1,$2,$3,$4)`, [outlet.id, code, locName, i]);
    }
    console.log("created outlet and locations");
  }
  await db.query(
    `insert into users (outlet_id, login, name, role, pin_hash) values ($1,$2,$3,$4,$5)
     on conflict (login) do update set name = excluded.name, role = excluded.role, pin_hash = excluded.pin_hash,
       active = true, failed_attempts = 0, locked_until = null, session_version = users.session_version + 1`,
    [outlet.id, login.toLowerCase(), name, role, bcrypt.hashSync(pin, 10)],
  );
  console.log(`user ${login} (${role}) ready`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
