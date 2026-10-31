"use client";

import { useEffect } from "react";
import Link from "next/link";
import { startSync, useSyncState } from "@/client/sync";
import { IconCloud, IconWifiOff } from "./icons";
import { useT } from "@/i18n/client";

/** สถานะสัญญาณและยอดที่ยังไม่ซิงก์ — ใช้ไอคอน + คำ ไม่พึ่งสีอย่างเดียว */
export function SyncBadge() {
  const s = useSyncState();
  const { t } = useT();
  useEffect(() => startSync(), []);

  if (s.authRequired) {
    return (
      <Link href="/login" className="pill bg-bad-soft text-bad">
        {t("เข้าสู่ระบบใหม่เพื่อซิงก์")}
      </Link>
    );
  }
  if (!s.online) {
    return (
      <span className="pill bg-warn-soft text-warn" role="status">
        <IconWifiOff width={14} height={14} />
        {s.pending > 0 ? t("ออฟไลน์ · รอซิงก์ {n}", { n: s.pending }) : t("ออฟไลน์")}
      </span>
    );
  }
  if (s.pending > 0 || s.syncing) {
    return (
      <span className="pill bg-sky-soft text-sky" role="status">
        <IconCloud width={14} height={14} />
        {s.syncing ? t("กำลังซิงก์…") : t("รอซิงก์ {n}", { n: s.pending })}
      </span>
    );
  }
  return (
    <span className="pill bg-ok-soft text-ok" role="status">
      <IconCloud width={14} height={14} />
      {t("ซิงก์แล้ว")}
    </span>
  );
}
