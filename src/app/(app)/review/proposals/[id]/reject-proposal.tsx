"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejectProposalAction } from "@/app/actions/proposals";
import { useT } from "@/i18n/client";

export function RejectProposal({ id }: { id: number }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost mb-6 w-full text-bad" onClick={() => setOpen(true)}>
        {t("ไม่อนุมัติรายการนี้")}
      </button>
    );
  }
  return (
    <form
      className="card mb-6 grid gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await rejectProposalAction(id, reason);
          setError(r.error);
          if (!r.error) {
            router.push("/review");
            router.refresh();
          }
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">{t("เหตุผลที่ไม่อนุมัติ (พนักงานจะเห็น)")}</span>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("เช่น มีอยู่แล้วในชื่อ Chili sauce")}
          autoFocus
        />
      </label>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn text-bad" disabled={pending || !reason.trim()}>
          {t("ยืนยันไม่อนุมัติ")}
        </button>
      </div>
    </form>
  );
}
