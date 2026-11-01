"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

// Small SVG charts for the executive console. No chart library: two forms are all
// the console needs. Hover/focus a day for every series' value; the same numbers
// are in the tables on the page, so the tooltip never gates anything.

export interface Series {
  label: string;
  /** CSS colour, e.g. var(--sky) */
  color: string;
}

export interface Point {
  /** x-axis label (short date) */
  label: string;
  /** null = no data that day (lines leave a gap before the first value) */
  values: (number | null)[];
}

const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

const baht = (n: number | null) => n === null ? "–" : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n) + " ฿";
const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${+(n / 1000).toFixed(0)}K` : n.toLocaleString("th-TH");

function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Every n-th label so they don't collide (about one per 64px). */
const labelEvery = (n: number, plotW: number) => Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 64))));

export function TimeChart({
  points,
  series,
  kind,
  ariaLabel,
}: {
  points: Point[];
  series: Series[];
  kind: "stack" | "line";
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const totals = points.map((p) => (kind === "stack" ? p.values.reduce<number>((s, v) => s + (v ?? 0), 0) : Math.max(0, ...p.values.map((v) => v ?? 0))));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1];
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const band = points.length ? plotW / points.length : 0;
  const cx = (i: number) => PAD.left + band * i + band / 2;
  const every = labelEvery(points.length, plotW);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={ariaLabel} className="block select-none">
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tk)} dy="0.32em" textAnchor="end" className="num fill-muted text-[11px]">
                {compact(tk)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                {p.label}
              </text>
            ) : null,
          )}

          {hover !== null && kind === "line" && (
            <line x1={cx(hover)} x2={cx(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeWidth={1} />
          )}

          {kind === "stack" ? (
            <Columns points={points} series={series} band={band} cx={cx} y={y} hover={hover} />
          ) : (
            <Lines points={points} series={series} cx={cx} y={y} plotBottom={PAD.top + plotH} />
          )}

          {/* hit areas: the whole day band, bigger than any mark */}
          {points.map((p, i) => (
            <rect
              key={i}
              x={PAD.left + band * i}
              y={PAD.top}
              width={band}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${p.label}: ${series.map((s, k) => `${s.label} ${baht(p.values[k])}`).join(", ")}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            />
          ))}
        </svg>
      )}
      {width === 0 && <div style={{ height: H }} />}
      {hover !== null && (
        <Tip
          left={Math.min(Math.max(cx(hover), 90), width - 90)}
          title={points[hover].label}
          rows={series.map((s, k) => ({ ...s, value: points[hover].values[k] }))}
          total={kind === "stack" && series.length > 1 ? totals[hover] : undefined}
        />
      )}
    </div>
  );
}

function Columns({
  points,
  series,
  band,
  cx,
  y,
  hover,
}: {
  points: Point[];
  series: Series[];
  band: number;
  cx: (i: number) => number;
  y: (v: number) => number;
  hover: number | null;
}) {
  const w = Math.min(24, Math.max(4, band * 0.6));
  return (
    <g>
      {points.map((p, i) => {
        let base = 0;
        const segs = p.values.map((raw, k) => {
          const v = raw ?? 0;
          const from = base;
          base += v;
          return { k, from, to: base, v };
        });
        const last = segs.filter((s) => s.v > 0).at(-1)?.k;
        return (
          <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
            {segs.map((s) => {
              if (s.v <= 0) return null;
              const y0 = y(s.from);
              // 2px surface gap between stacked segments
              const y1 = y(s.to) + (s.k === last ? 0 : 2);
              const h = Math.max(0, y0 - y1);
              const x = cx(i) - w / 2;
              const r = s.k === last ? Math.min(4, h, w / 2) : 0;
              return (
                <path
                  key={s.k}
                  fill={series[s.k].color}
                  d={`M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Lines({
  points,
  series,
  cx,
  y,
  plotBottom,
}: {
  points: Point[];
  series: Series[];
  cx: (i: number) => number;
  y: (v: number) => number;
  plotBottom: number;
}) {
  if (points.length === 0) return null;
  return (
    <g>
      {series.map((s, k) => {
        const idx = points.flatMap((p, i) => (p.values[k] === null ? [] : [i]));
        if (idx.length === 0) return null;
        const line = idx.map((i, j) => `${j ? "L" : "M"}${cx(i)},${y(points[i].values[k]!)}`).join(" ");
        const [first, n] = [idx[0], idx[idx.length - 1]];
        const area = `${line} L${cx(n)},${plotBottom} L${cx(first)},${plotBottom} Z`;
        return (
          <g key={k}>
            {series.length === 1 && <path d={area} fill={s.color} opacity={0.1} />}
            <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={cx(n)} cy={y(points[n].values[k]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        );
      })}
    </g>
  );
}

function Tip({
  left,
  title,
  rows,
  total,
}: {
  left: number;
  title: string;
  rows: (Series & { value: number | null })[];
  total?: number;
}) {
  const { t } = useT();
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg"
      style={{ left }}
    >
      <p className="mb-1 text-xs text-muted">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: r.color }} />
            {r.label}
          </span>
          <b className="num">{baht(r.value)}</b>
        </p>
      ))}
      {total !== undefined && (
        <p className="mt-1 flex justify-between gap-4 border-t border-line pt-1">
          <span className="text-muted">{t("รวม")}</span>
          <b className="num">{baht(total)}</b>
        </p>
      )}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {series.map((s) => (
        <li key={s.label} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
