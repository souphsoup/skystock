"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Lang, type TFn } from "./index";

const Ctx = createContext<Lang>("th");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useT(): { lang: Lang; t: TFn } {
  const lang = useContext(Ctx);
  return useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
}
