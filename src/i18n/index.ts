// Thai is the source language: the Thai text itself is the key, so code stays
// readable for the shop's team. English lives in src/i18n/en/*. A missing English
// entry falls back to the Thai text. Check with `npm run i18n:check`.
//
//   t("ยกเลิก")                                  → "Cancel"
//   t("เหลือ {n} {unit}", { n: 2, unit })        → "2 pcs left"
//   English values may pluralise: "{n, # item, # items}" (# = the number)

import { en } from "./en";

export type Lang = "th" | "en";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];
export const LANG_COOKIE = "sop_lang";
export const isLang = (v: unknown): v is Lang => v === "th" || v === "en";

export type Params = Record<string, string | number | null | undefined>;
export type TFn = (text: string, params?: Params) => string;

/** Marks a Thai string as a translation key without translating it yet (labels in constants). */
export const tk = (text: string) => text;

const PLACEHOLDER = /\{(\w+)(?:,\s*([^,}]*),\s*([^}]*))?\}/g;

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(PLACEHOLDER, (m, key: string, one?: string, many?: string) => {
    if (!(key in params)) return m;
    const v = params[key] ?? "";
    if (one === undefined) return String(v);
    return (Number(v) === 1 ? one : many!).replace("#", String(v));
  });
}

export function translate(lang: Lang, text: string, params?: Params): string {
  return interpolate(lang === "en" ? (en[text] ?? text) : text, params);
}

export const makeT =
  (lang: Lang): TFn =>
  (text, params) =>
    translate(lang, text, params);

// Error params that hold a field name (a tk() key) rather than data such as an item name.
const KEY_PARAMS = new Set(["field", "label"]);

/** Translates an error message; {field} / {label} params are translated too. */
export function translateError(lang: Lang, message: string, params?: Params): string {
  if (lang === "th" || !params) return translate(lang, message, params);
  const p: Params = { ...params };
  for (const k of KEY_PARAMS) if (typeof p[k] === "string") p[k] = translate(lang, p[k] as string);
  return translate(lang, message, p);
}
