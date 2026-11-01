import Link from "next/link";
import { addDays, businessDate } from "@/lib/dates";
import type { TFn } from "@/i18n";

// Shared bits of the executive console pages (/admin/*).

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function rangeOf(v: string | string[] | undefined): { range: Range; from: string; to: string } {
  const range = RANGES.find((r) => String(r) === v) ?? 30;
  const to = businessDate();
  return { range, from: addDays(to, -(range - 1)), to };
}

export function RangeTabs({ path, range, t }: { path: string; range: Range; t: TFn }) {
  return (
    <nav className="flex rounded-xl border border-line bg-surface p-1" aria-label={t("ช่วงเวลา")}>
      {RANGES.map((r) => (
        <Link
          key={r}
          href={r === 30 ? path : `${path}?range=${r}`}
          aria-current={r === range ? "page" : undefined}
          className={`min-h-9 rounded-lg px-4 py-1.5 text-sm font-semibold ${
            r === range ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
          }`}
        >
          {t("{n} วันล่าสุด", { n: r })}
        </Link>
      ))}
    </nav>
  );
}

export function ConsoleHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted">{eyebrow}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}
