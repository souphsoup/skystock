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
