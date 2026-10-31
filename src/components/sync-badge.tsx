"use client";

import { useEffect } from "react";
import Link from "next/link";
import { startSync, useSyncState } from "@/client/sync";
import { IconCloud, IconWifiOff } from "./icons";

/** สถานะสัญญาณและยอดที่ยังไม่ซิงก์ — ใช้ไอคอน + คำ ไม่พึ่งสีอย่างเดียว */
export function SyncBadge() {
  const s = useSyncState();
  useEffect(() => startSync(), []);

  if (s.authRequired) {
    return (
      <Link href="/login" className="pill bg-bad-soft text-bad">
        เข้าสู่ระบบใหม่เพื่อซิงก์
      </Link>
    );
  }
  if (!s.online) {
    return (
      <span className="pill bg-warn-soft text-warn" role="status">
        <IconWifiOff width={14} height={14} />
        ออฟไลน์{s.pending > 0 ? ` · รอซิงก์ ${s.pending}` : ""}
      </span>
    );
  }
  if (s.pending > 0 || s.syncing) {
    return (
      <span className="pill bg-sky-soft text-sky" role="status">
        <IconCloud width={14} height={14} />
        {s.syncing ? "กำลังซิงก์…" : `รอซิงก์ ${s.pending}`}
      </span>
    );
  }
  return (
    <span className="pill bg-ok-soft text-ok" role="status">
      <IconCloud width={14} height={14} />
      ซิงก์แล้ว
    </span>
  );
}
