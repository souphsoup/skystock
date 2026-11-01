"use client";

import { useT } from "@/i18n/client";
import { IconMonitor, IconPhone } from "./icons";
import { VIEW_KEY } from "./phone-view-script";

function setPhoneView(on: boolean) {
  try {
    if (on) localStorage.setItem(VIEW_KEY, "phone");
    else localStorage.removeItem(VIEW_KEY);
  } catch {}
  const html = document.documentElement;
  if (on) html.setAttribute("data-view", "phone");
  else html.removeAttribute("data-view");
  window.scrollTo(0, 0);
}

/** In the desktop sidebar (the sidebar itself disappears once phone view is on). */
export function PhoneViewButton() {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => setPhoneView(true)}
      className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted hover:bg-paper"
    >
      <IconPhone width={18} height={18} />
      <span className="flex-1 text-left">{t("มุมมองมือถือ")}</span>
    </button>
  );
}

/** Beside the phone-width page, on wide screens only; hidden by CSS unless phone view is on. */
export function PhoneViewExit() {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => setPhoneView(false)}
      className="btn fixed top-6 left-[calc(50%+var(--phone-w)/2+24px)] z-30 hidden text-sm shadow-sm phone-view:inline-flex print:hidden"
    >
      <IconMonitor width={18} height={18} />
      {t("กลับมุมมองคอม")}
    </button>
  );
}
