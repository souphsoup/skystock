// Shared (client + server) types for รับของ / เบิก / โอน / ของเสีย.

export type MoveKind = "receive" | "issue" | "transfer" | "waste";

export const KIND_LABEL: Record<MoveKind, string> = {
  receive: "รับของเข้า",
  issue: "เบิกเข้าครัว",
  transfer: "โอนระหว่างจุด",
  waste: "ของเสีย",
};

export const WASTE_REASONS: Record<string, string> = {
  expired: "หมดอายุ",
  spilled: "ทำหก / ตกแตก",
  spoiled: "เสีย / คุณภาพไม่ผ่าน",
  returned: "ส่งคืนซัพพลายเออร์",
  other: "อื่นๆ",
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
