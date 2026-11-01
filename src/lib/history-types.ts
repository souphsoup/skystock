// Shared (client + server) labels for the edit history (audit_log) screen.
import { tk } from "@/i18n";

export type HistoryArea = "all" | "count" | "move" | "catalog" | "admin";

/** prefixes = the part of audit_log.action before the dot */
export const AREAS: Record<HistoryArea, { label: string; prefixes: string[] }> = {
  all: { label: tk("ทั้งหมด"), prefixes: [] },
  count: { label: tk("นับ / ตรวจยอด"), prefixes: ["count", "line"] },
  move: { label: tk("รับ · เบิก · โอน · ของเสีย"), prefixes: ["movement"] },
  catalog: { label: tk("รายการ / หมวด"), prefixes: ["item", "category", "proposal"] },
  admin: { label: tk("ผู้ใช้ / ระบบ"), prefixes: ["user", "notify"] },
};
export const isArea = (v: unknown): v is HistoryArea => typeof v === "string" && v in AREAS;

export const HISTORY_DAYS = [1, 7, 30] as const;

/** Thai keys: render with t() */
export const ACTION_LABEL: Record<string, string> = {
  "count.submit": tk("ส่งยอดนับ"),
  "count.resubmit": tk("ส่งยอดนับซ้ำ"),
  "count.approve": tk("อนุมัติรอบนับ"),
  "count.approve_matched": tk("อนุมัติรายการที่ตรงกัน"),
  "line.recount_edit": tk("แก้ยอดตอนนับซ้ำ"),
  "line.confirm": tk("ยืนยันยอดที่ต่าง"),
  "line.request_recount": tk("สั่งนับซ้ำ"),
  "line.adjust": tk("หัวหน้าแก้ยอด"),
  "movement.create": tk("บันทึก"),
  "movement.void": tk("ยกเลิกรายการ"),
  "item.create": tk("เพิ่มรายการ"),
  "item.update": tk("แก้ไขรายการ"),
  "item.activate": tk("เปิดใช้รายการ"),
  "item.deactivate": tk("ปิดใช้รายการ"),
  "category.create": tk("เพิ่มหมวด"),
  "category.rename": tk("เปลี่ยนชื่อหมวด"),
  "category.delete": tk("ลบหมวด"),
  "proposal.create": tk("เสนอรายการใหม่"),
  "proposal.approve": tk("อนุมัติรายการที่เสนอ"),
  "proposal.reject": tk("ไม่อนุมัติรายการที่เสนอ"),
  "user.create": tk("เพิ่มผู้ใช้"),
  "user.update": tk("แก้ไขผู้ใช้"),
  "user.reset_pin": tk("ตั้ง PIN ใหม่"),
  "user.change_pin": tk("เปลี่ยน PIN ของตัวเอง"),
  "user.activate": tk("เปิดใช้ผู้ใช้"),
  "user.deactivate": tk("ปิดใช้ผู้ใช้"),
  "user.revoke_sessions": tk("ออกจากระบบทุกเครื่อง"),
  "notify.add": tk("เพิ่มผู้รับสรุปตอนเช้า"),
  "notify.active": tk("เปิด/ปิดผู้รับสรุปตอนเช้า"),
  "notify.lang": tk("เปลี่ยนภาษาผู้รับสรุป"),
  "notify.remove": tk("ลบผู้รับสรุปตอนเช้า"),
};

/** Tone of the action pill: corrections and removals stand out. */
export function actionTone(action: string): "bad" | "warn" | "ok" | "sky" {
  if (/\.(void|delete|remove|deactivate|reject|reset_pin|revoke_sessions)$/.test(action)) return "bad";
  if (/^line\.(adjust|recount_edit|request_recount)$|\.update$|\.rename$/.test(action)) return "warn";
  if (/approve|confirm/.test(action)) return "ok";
  return "sky";
}
