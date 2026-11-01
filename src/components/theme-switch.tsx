"use client";

import { useSyncExternalStore } from "react";
import { tk } from "@/i18n";
import { useT } from "@/i18n/client";
import { THEME_KEY, type ThemePref } from "./theme-script";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: tk("ตามเครื่อง") },
  { value: "light", label: tk("สว่าง") },
  { value: "dark", label: tk("มืด") },
];

const CHANGE = "sop-theme";

function read(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

function choose(v: ThemePref) {
  try {
    if (v === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, v);
  } catch {}
  (window as Window & { __sopTheme?: () => void }).__sopTheme?.();
  window.dispatchEvent(new Event(CHANGE));
}

/** This device only: shared kitchen phones keep their own look whoever signs in. */
export function ThemeSwitch() {
  const { t } = useT();
  const pref = useSyncExternalStore(subscribe, read, () => null);
  return (
    <div role="radiogroup" aria-label={t("ธีม")} className="flex w-full rounded-xl border border-line bg-surface p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => choose(o.value)}
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
