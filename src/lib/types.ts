// Types shared by server and client (no server-only imports here).

import { tk } from "@/i18n";
import type { SheetProposal } from "./proposal-types";

export type Role = "operation" | "supervisor" | "manager" | "admin";
export type CountStatus = "draft" | "submitted" | "recount" | "approved";
export type LineStatus = "pending" | "ok" | "flag" | "recount" | "confirmed";

/** Thai keys: render with t(ROLE_LABEL[role]) */
export const ROLE_LABEL: Record<Role, string> = {
  operation: "Operation",
  supervisor: tk("หัวหน้า"),
  manager: tk("ทีมบริหาร"),
  admin: "Admin",
};

export const can = {
  count: (r: Role) => r === "operation" || r === "supervisor" || r === "admin",
  review: (r: Role) => r === "supervisor" || r === "admin",
  dashboard: (r: Role) => r !== "operation",
  settings: (r: Role) => r === "supervisor" || r === "admin",
  users: (r: Role) => r === "admin",
};

export interface SheetLine {
  itemId: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  par: number;
  blind: boolean;
  path: string[]; // หมวด › ชนิด › ส่วน
  // null when blind (hidden from the counter) or when there is no previous count
  opening: number | null;
  inQty: number; // typed on the sheet by staff
  outQty: number;
  mvIn: number; // from รับของ / โอนเข้า (server-maintained)
  mvOut: number; // from เบิก / โอนออก / ของเสีย
  counted: number | null;
  status: LineStatus;
  editable: boolean;
}

export interface Sheet {
  countId: number;
  locationId: number;
  locationName: string;
  businessDate: string;
  status: CountStatus;
  lines: SheetLine[];
  /** items staff proposed for this location (missing on sheets cached before this field existed) */
  proposals?: SheetProposal[];
  fetchedAt: number;
}

export interface LineInput {
  itemId: number;
  inQty: number;
  outQty: number;
  counted: number | null;
}

export interface StockAlert {
  itemId: number;
  name: string;
  unit: string;
  par: number;
  counted: number;
  level: "out" | "low";
  locationName: string;
}

export function expectedOf(l: Pick<SheetLine, "opening" | "inQty" | "outQty" | "mvIn" | "mvOut">): number | null {
  return l.opening === null ? null : round2(l.opening + l.mvIn + l.inQty - l.mvOut - l.outQty);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function itemLabel(l: { nameTh: string; nameEn: string }): string {
  return l.nameEn || l.nameTh;
}
