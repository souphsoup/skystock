import type { CountStatus } from "@/lib/types";
import { makeT, tk, type Lang } from "@/i18n";

const COUNT_STATUS: Record<CountStatus | "none", { label: string; cls: string; mark: string }> = {
  none: { label: tk("ยังไม่เริ่ม"), cls: "bg-sky-soft text-sky", mark: "○" },
  draft: { label: tk("กำลังนับ"), cls: "bg-accent-soft text-accent", mark: "◐" },
  submitted: { label: tk("รอหัวหน้าตรวจ"), cls: "bg-sky-soft text-sky", mark: "◔" },
  recount: { label: tk("ต้องนับซ้ำ"), cls: "bg-bad-soft text-bad", mark: "↺" },
  approved: { label: tk("อนุมัติแล้ว"), cls: "bg-ok-soft text-ok", mark: "✓" },
};

export function CountStatusPill({ status, lang }: { status: CountStatus | null; lang: Lang }) {
  const s = COUNT_STATUS[status ?? "none"];
  const t = makeT(lang);
  return (
    <span className={`pill ${s.cls}`}>
      <span aria-hidden>{s.mark}</span>
      {t(s.label)}
    </span>
  );
}

export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm text-muted">{eyebrow}</p>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export const fmtQty = (n: number | null | undefined) =>
  n === null || n === undefined ? "–" : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(n);

export const fmtBaht = (n: number) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n) + " ฿";

export const fmtSigned = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtQty(Math.abs(n));
