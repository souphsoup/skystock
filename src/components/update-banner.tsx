"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

const CHECK_MS = 5 * 60_000;

/** แจ้งว่ามีเวอร์ชันใหม่ขึ้นแล้ว ให้กดรีเฟรช — แอปที่ติดตั้งบนจอเปิดค้างไว้ได้หลายวันโดยไม่โหลดใหม่ */
export function UpdateBanner() {
  const { t } = useT();
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const check = async () => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== process.env.APP_VERSION) setHasUpdate(true);
      } catch {
        // offline or server busy: try again next time
      }
    };
    const onVisible = () => document.visibilityState === "visible" && check();
    check();
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);

  if (!hasUpdate) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div role="status" className="card mx-auto flex max-w-xl items-center gap-3 p-3 shadow-lg">
        <p className="flex-1 text-sm font-medium">{t("มีอัปเดตใหม่ แตะรีเฟรชเพื่อใช้เวอร์ชันล่าสุด")}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t("รีเฟรช")}
        </button>
      </div>
    </div>
  );
}
