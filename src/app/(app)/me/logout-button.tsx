"use client";

import { useState, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { pendingCount } from "@/client/local-db";
import { clearDeviceSession } from "@/client/logout";
import { syncNow } from "@/client/sync";
import { useT } from "@/i18n/client";

export function LogoutButton() {
  const [pending, start] = useTransition();
  const [warning, setWarning] = useState<string | null>(null);
  const { t } = useT();

  return (
    <>
      <button
        type="button"
        className="btn w-full text-bad"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await syncNow();
            const left = await pendingCount();
            if (left > 0) {
              setWarning(t("ยังมี {n} รายการที่ยังไม่ซิงก์ ต่อสัญญาณแล้วรอให้ซิงก์เสร็จก่อนออกจากระบบ", { n: left }));
              return;
            }
            await clearDeviceSession();
            await logoutAction();
          })
        }
      >
        {pending ? t("กำลังออกจากระบบ…") : t("ออกจากระบบ")}
      </button>
      {warning && (
        <p role="alert" className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
          {warning}
        </p>
      )}
    </>
  );
}
