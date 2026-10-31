"use client";

import { useEffect } from "react";
import { useT } from "@/i18n/client";

/** Opens the print dialog once the Thai font has loaded; "Save as PDF" there gives the file. */
export function PrintButton() {
  const { t } = useT();

  useEffect(() => {
    let on = true;
    document.fonts.ready.then(() => on && window.print());
    return () => {
      on = false;
    };
  }, []);

  return (
    <button type="button" className="btn btn-primary min-h-10 px-4 text-sm" onClick={() => window.print()}>
      {t("พิมพ์ / บันทึก PDF")}
    </button>
  );
}
