"use client";

import { useState, useTransition } from "react";
import { voidMovementAction } from "@/app/actions/movements";

export function VoidButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="mt-2 min-h-10 text-sm text-muted underline" onClick={() => setOpen(true)}>
        บันทึกผิด? ยกเลิกรายการนี้
      </button>
    );
  }
  return (
    <div className="mt-3 grid gap-2">
      <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล เช่น ใส่จำนวนผิด" aria-label="เหตุผลที่ยกเลิก" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
          ไม่ยกเลิก
        </button>
        <button
          type="button"
          className="btn text-bad"
          disabled={pending || !reason.trim()}
          onClick={() =>
            start(async () => {
              const r = await voidMovementAction(id, reason);
              setError(r.error);
            })
          }
        >
          ยืนยันยกเลิก
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
