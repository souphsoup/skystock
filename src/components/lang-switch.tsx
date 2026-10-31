"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLangAction } from "@/app/actions/lang";
import { LANGS } from "@/i18n";
import { useT } from "@/i18n/client";

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      role="radiogroup"
      aria-label={`${t("ภาษา")} / Language`}
      className={`flex rounded-xl border border-line bg-surface p-1 ${compact ? "" : "w-full"}`}
    >
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={lang === l.value}
          disabled={pending}
          lang={l.value}
          onClick={() =>
            lang !== l.value &&
            start(async () => {
              await setLangAction(l.value);
              router.refresh();
            })
          }
          className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold ${
            lang === l.value ? "bg-accent text-accent-ink" : "text-muted"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
