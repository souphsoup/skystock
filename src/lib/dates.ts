// Business-date helpers. The bar runs 17:00–24:00 and the closing count can
// run past midnight, so anything before 06:00 belongs to the previous day.

export const TZ = "Asia/Bangkok";
const DAY_CUTOFF_HOURS = 6;

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function businessDate(now: Date = new Date()): string {
  return ymd.format(new Date(now.getTime() - DAY_CUTOFF_HOURS * 3600_000));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Period = "day" | "week" | "month";

export function periodRange(period: Period, today = businessDate()): { from: string; to: string } {
  if (period === "day") return { from: today, to: today };
  if (period === "week") return { from: addDays(today, -6), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 92;

/** ?from=&to= from the console (validated, at most 92 days), else the dashboard's ?period=. */
export function reportRange(q: { period?: unknown; from?: unknown; to?: unknown }): { from: string; to: string } {
  const { from, to } = q;
  if (typeof from === "string" && typeof to === "string" && ISO_DAY.test(from) && ISO_DAY.test(to) && from <= to) {
    if (addDays(from, MAX_RANGE_DAYS - 1) >= to && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to))) {
      return { from, to };
    }
  }
  const p = q.period;
  return periodRange(p === "day" || p === "month" ? p : "week");
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Formatters take the UI language (src/i18n). Thai uses the Thai calendar month names.
type L = "th" | "en";
const LOCALE: Record<L, string> = { th: "th-TH", en: "en-GB" };
const fmts = new Map<string, Intl.DateTimeFormat>();
function df(lang: L, kind: string, opts: Intl.DateTimeFormatOptions) {
  const key = `${lang}:${kind}`;
  let f = fmts.get(key);
  if (!f) fmts.set(key, (f = new Intl.DateTimeFormat(LOCALE[lang], { hourCycle: "h23", ...opts })));
  return f;
}
const day = (date: string) => new Date(`${date}T00:00:00Z`);

export const fmtDay = (date: string, lang: L = "th") =>
  df(lang, "day", { timeZone: "UTC", day: "numeric", month: "short" }).format(day(date));
export const fmtWeekday = (date: string, lang: L = "th") =>
  df(lang, "weekday", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(day(date));
export const fmtTime = (at: string | Date, lang: L = "th") =>
  df(lang, "time", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(at));
export const fmtDateTime = (at: string | Date, lang: L = "th") =>
  df(lang, "datetime", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(at),
  );

export function fmtRange(from: string, to: string, lang: L = "th"): string {
  if (from === to) return fmtDay(from, lang);
  const [a, b] = [fmtDay(from, lang), fmtDay(to, lang)];
  // "24 ต.ค." – "30 ต.ค." → "24–30 ต.ค." when the month matches
  const ma = a.split(" ").slice(1).join(" ");
  const mb = b.split(" ").slice(1).join(" ");
  return ma === mb ? `${a.split(" ")[0]}–${b}` : `${a} – ${b}`;
}

export function fmtDateSlash(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
