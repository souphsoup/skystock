// Shared by the notify settings page (server) and its client component.

export type RunStatus = "sending" | "sent" | "partial" | "failed" | "dry_run" | "no_targets";

export const RUN_STATUS: Record<RunStatus, { label: string; cls: string }> = {
  sending: { label: "กำลังส่ง", cls: "bg-sky-soft text-sky" },
  sent: { label: "ส่งแล้ว", cls: "bg-ok-soft text-ok" },
  partial: { label: "ส่งได้บางส่วน", cls: "bg-warn-soft text-warn" },
  failed: { label: "ส่งไม่สำเร็จ", cls: "bg-bad-soft text-bad" },
  dry_run: { label: "ทดลอง ไม่ได้ส่งจริง", cls: "bg-line text-muted" },
  no_targets: { label: "ไม่มีผู้รับ", cls: "bg-line text-muted" },
};
