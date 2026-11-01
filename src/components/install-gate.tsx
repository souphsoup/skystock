"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/client";
import { IconDownload, IconShare } from "./icons";
import { INSTALL_SKIP_KEY } from "./install-gate-script";

// The phone-only "install first" screen; see install-gate-script.ts for when it shows.

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __sopInstall?: InstallPrompt | null;
    __sopInstalled?: boolean;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("sop-install", cb);
  return () => window.removeEventListener("sop-install", cb);
};
const installState = () => (window.__sopInstalled ? "installed" : window.__sopInstall ? "ready" : "manual");

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-ink">
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function AndroidInstall() {
  const { t } = useT();
  const state = useSyncExternalStore(subscribe, installState, () => "manual");

  if (state === "installed") {
    return (
      <p className="rounded-xl bg-ok-soft px-4 py-3 font-medium text-ok">
        {t("ติดตั้งแล้ว เปิด meStock จากไอคอนบนหน้าจอได้เลย")}
      </p>
    );
  }
  if (state === "ready") {
    return (
      <button
        type="button"
        className="btn btn-primary w-full text-lg"
        onClick={async () => {
          const p = window.__sopInstall;
          if (!p) return;
          await p.prompt();
          // A prompt can only be used once; Chrome sends a new one if the user dismissed it.
          window.__sopInstall = null;
          window.dispatchEvent(new Event("sop-install"));
        }}
      >
        <IconDownload /> {t("ติดตั้งแอป")}
      </button>
    );
  }
  return (
    <Steps
      steps={[
        <>{t("แตะ ⋮ มุมขวาบนของ Chrome")}</>,
        <>{t("เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”")}</>,
        <>{t("เปิด meStock จากไอคอนบนหน้าจอ")}</>,
      ]}
    />
  );
}

export function InstallGate() {
  const { t } = useT();

  function skip() {
    sessionStorage.setItem(INSTALL_SKIP_KEY, "1");
    document.documentElement.removeAttribute("data-install");
  }

  return (
    <div id="install-gate">
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
          <img src="/icons/icon-192.png" alt="" width={80} height={80} className="rounded-2xl" />
          <p className="mt-4 text-sm font-semibold tracking-wide text-hl">MAI The Sky Bar</p>
          <h1 className="mt-1 text-2xl font-bold">{t("ติดตั้ง meStock ลงเครื่อง")}</h1>
          <p className="mt-1 text-muted">{t("เปิดจากไอคอนบนหน้าจอ ใช้งานได้แม้สัญญาณหลุด")}</p>
        </div>

        <div className="card p-5">
          <div data-for="line" className="flex flex-col gap-4">
            <p>{t("ลิงก์นี้เปิดอยู่ใน LINE ซึ่งติดตั้งแอปไม่ได้ ให้เปิดในเบราว์เซอร์ก่อน")}</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- LINE only reacts to a full page load */}
            <a href="/?openExternalBrowser=1" className="btn btn-primary w-full text-lg">
              {t("เปิดใน Safari / Chrome")}
            </a>
          </div>

          <div data-for="inapp">
            <Steps
              steps={[
                <>{t("แตะ ⋯ มุมขวาบน")}</>,
                <>{t("เลือก “เปิดในเบราว์เซอร์” (Safari / Chrome)")}</>,
                <>{t("ทำตามขั้นตอนติดตั้งที่ขึ้นมา")}</>,
              ]}
            />
          </div>

          <div data-for="ios">
            <Steps
              steps={[
                <span key="share" className="inline-flex flex-wrap items-center gap-1">
                  {t("แตะปุ่มแชร์")} <IconShare className="inline text-sky" width={20} height={20} />{" "}
                  {t("ในแถบของ Safari")}
                </span>,
                <>{t("เลือก “เพิ่มไปยังหน้าจอโฮม”")}</>,
                <>{t("แตะ “เพิ่ม” แล้วเปิด meStock จากไอคอนบนหน้าจอ")}</>,
              ]}
            />
          </div>

          <div data-for="android">
            <AndroidInstall />
          </div>
        </div>

        <p className="text-center text-sm text-muted">
          {t("ติดตั้งไว้แล้ว? เปิดจากไอคอน meStock บนหน้าจอได้เลย")}
        </p>
        <button type="button" className="btn btn-ghost border-0 text-sm text-muted underline" onClick={skip}>
          {t("ใช้งานในเบราว์เซอร์ไปก่อน")}
        </button>
      </main>
    </div>
  );
}
