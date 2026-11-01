// Shared (client + server) types for รับของ / เบิก / โอน / ของเสีย.
import { tk } from "@/i18n";

export type MoveKind = "receive" | "issue" | "transfer" | "waste";

export const KIND_LABEL: Record<MoveKind, string> = {
  receive: tk("รับของเข้า"),
  issue: tk("เบิกเข้าครัว"),
  transfer: tk("โอนระหว่างจุด"),
  waste: tk("ของเสีย"),
};

export const WASTE_REASONS: Record<string, string> = {
  expired: tk("หมดอายุ"),
  spilled: tk("ทำหก / ตกแตก"),
  spoiled: tk("เสีย / คุณภาพไม่ผ่าน"),
  returned: tk("ส่งคืนซัพพลายเออร์"),
  other: tk("อื่นๆ"),
};

/**
 * Label key for a stored reason, or null if it isn't one of ours. Use this instead of
 * `reason in WASTE_REASONS` / `WASTE_REASONS[reason]`: those also match inherited names
 * like "constructor", which once let a bad reason through and broke the Excel export.
 */
export function wasteReasonLabel(reason: string | null | undefined): string | null {
  return reason && Object.hasOwn(WASTE_REASONS, reason) ? WASTE_REASONS[reason] : null;
}

export interface MoveInput {
  clientId: string;
  kind: MoveKind;
  locationId: number; // receive: ที่เก็บของที่รับ, อื่นๆ: จุดต้นทาง
  toLocationId?: number | null; // transfer only
  supplier?: string;
  reason?: string; // waste only (key of WASTE_REASONS)
  note?: string;
  recordedAt: number; // ms, when it was recorded on the device
  lines: { itemId: number; qty: number }[];
}
