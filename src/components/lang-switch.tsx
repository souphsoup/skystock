"use client";

import { Fragment, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLangAction } from "@/app/actions/lang";
import { LANGS, type Lang } from "@/i18n";
import { useT } from "@/i18n/client";

/** `text`: a quiet "ไทย · English" line, for the login page footer. */
export function LangSwitch({ compact = false, text = false }: { compact?: boolean; text?: boolean }) {
  const { lang, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: Lang) =>
    lang !== l &&
    start(async () => {
      await setLangAction(l);
      router.refresh();
    });

  if (text) {
    return (
      <div role="radiogroup" aria-label={`${t("ภาษา")} / Language`} className="flex items-center text-sm">
        {LANGS.map((l, i) => (
          <Fragment key={l.value}>
            {i > 0 && <span aria-hidden className="text-muted">·</span>}
            <button
              type="button"
              role="radio"
              aria-checked={lang === l.value}
              disabled={pending}
              lang={l.value}
              onClick={() => pick(l.value)}
              className={`min-h-10 px-1.5 ${lang === l.value ? "font-semibold text-ink" : "text-muted"}`}
            >
              {l.label}
            </button>
          </Fragment>
        ))}
      </div>
    );
  }

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
          onClick={() => pick(l.value)}
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
