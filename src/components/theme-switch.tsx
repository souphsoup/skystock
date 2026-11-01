"use client";

import { useSyncExternalStore } from "react";
import { tk } from "@/i18n";
import { useT } from "@/i18n/client";
import { THEME_KEY, TONE_KEY, type ThemePref, type TonePref } from "./theme-script";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: tk("ตามเครื่อง") },
  { value: "light", label: tk("สว่าง") },
  { value: "dark", label: tk("มืด") },
];

const TONE_OPTIONS: { value: TonePref; label: string }[] = [
  { value: "sand", label: tk("ทราย") },
  { value: "gold", label: tk("ทอง") },
];

const CHANGE = "sop-theme";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Nothing (or junk) stored → the first option, which is the default and never stored. */
function reader<T extends string>(key: string, options: { value: T }[]) {
  return (): T => {
    try {
      const v = localStorage.getItem(key);
      return options.find((o) => o.value === v)?.value ?? options[0].value;
    } catch {
      return options[0].value;
    }
  };
}

const readTheme = reader(THEME_KEY, THEME_OPTIONS);
const readTone = reader(TONE_KEY, TONE_OPTIONS);

function choose(key: string, v: string, fallback: string) {
  try {
    if (v === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {}
  (window as Window & { __sopTheme?: () => void }).__sopTheme?.();
  window.dispatchEvent(new Event(CHANGE));
}

function Segmented<T extends string>({
  label,
  storageKey,
  options,
  read,
}: {
  label: string;
  storageKey: string;
  options: { value: T; label: string }[];
  read: () => T;
}) {
  const { t } = useT();
  const pref = useSyncExternalStore(subscribe, read, () => null);
  return (
    <div role="radiogroup" aria-label={t(label)} className="flex w-full rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => choose(storageKey, o.value, options[0].value)}
          className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold ${
            pref === o.value ? "bg-accent text-accent-ink" : "text-muted"
          }`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

/** This device only: shared kitchen phones keep their own look whoever signs in. */
export function ThemeSwitch() {
  return <Segmented label={tk("ธีม")} storageKey={THEME_KEY} options={THEME_OPTIONS} read={readTheme} />;
}

/** Sand (แบบ A, default) or the app's original gold (แบบ A1); this device only, like the theme. */
export function ToneSwitch() {
  return <Segmented label={tk("โทนสี")} storageKey={TONE_KEY} options={TONE_OPTIONS} read={readTone} />;
}
