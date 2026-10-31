// Shared by the notify settings page (server) and its client component.
import { tk } from "@/i18n";

export type RunStatus = "sending" | "sent" | "partial" | "failed" | "dry_run" | "no_targets";

/** label is a Thai key: render with t(RUN_STATUS[status].label) */
export const RUN_STATUS: Record<RunStatus, { label: string; cls: string }> = {
  sending: { label: tk("กำลังส่ง"), cls: "bg-sky-soft text-sky" },
  sent: { label: tk("ส่งแล้ว"), cls: "bg-ok-soft text-ok" },
  partial: { label: tk("ส่งได้บางส่วน"), cls: "bg-warn-soft text-warn" },
  failed: { label: tk("ส่งไม่สำเร็จ"), cls: "bg-bad-soft text-bad" },
  dry_run: { label: tk("ทดลอง ไม่ได้ส่งจริง"), cls: "bg-line text-muted" },
  no_targets: { label: tk("ไม่มีผู้รับ"), cls: "bg-line text-muted" },
};
