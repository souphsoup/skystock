"use client";

import { useState, useTransition } from "react";
import {
  adjustLineAction,
  approveMatchedAction,
  confirmLineAction,
  recountLineAction,
} from "@/app/actions/review";
import type { ReviewLine } from "@/lib/stock";
import { fmtQty, fmtSigned } from "@/components/status";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error: string | null }>) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
    });
  return { pending, error, run };
}

export function FlaggedLine({ countId, line }: { countId: number; line: ReviewLine }) {
  const { pending, error, run } = useAction();
  const [adjusting, setAdjusting] = useState(false);
  const [qty, setQty] = useState(String(line.counted ?? ""));
  const [reason, setReason] = useState("");
  const n = Number(qty);
  const validQty = qty.trim() !== "" && Number.isFinite(n) && n >= 0;
  const v = line.variance ?? 0;

  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <b className="text-lg">{line.name}</b>
          {line.blind && <span className="pill ml-2 bg-sky-soft text-sky">Blind</span>}
          <p className="num text-sm text-muted">
            นับได้ {fmtQty(line.counted)} · ควรเหลือ {fmtQty(line.expected)}
          </p>
          <p className="num text-xs text-muted">
            ยกมา {fmtQty(line.opening)} + in {fmtQty(line.inQty)} − out {fmtQty(line.outQty)}
          </p>
          {(line.mvIn > 0 || line.mvOut > 0) && (
            <p className="text-xs text-muted">
              จากบันทึก: รับ/โอนเข้า {fmtQty(line.mvIn)} · เบิก/โอน/เสีย {fmtQty(line.mvOut)}
            </p>
          )}
        </div>
        <span className={`pill num text-sm ${v < 0 ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
          {fmtSigned(v)} {line.unit}
        </span>
      </div>
      {line.hint && <p className="mt-2 text-sm text-warn">⚠ {line.hint}</p>}

      {adjusting ? (
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">ยอดที่ถูกต้อง ({line.unit})</span>
            <input className="input num" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">เหตุผล (บันทึกใน Audit log)</span>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ตรวจนับเองแล้ว พบอีก 2 แพ็กในชั้นล่าง"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={() => setAdjusting(false)} disabled={pending}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !validQty || !reason.trim()}
              onClick={() => run(() => adjustLineAction(countId, line.itemId, n, reason))}
            >
              บันทึกยอดใหม่
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-ok"
              disabled={pending}
              onClick={() => run(() => confirmLineAction(countId, line.itemId))}
            >
              ✓ ยืนยันยอด
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => run(() => recountLineAction(countId, line.itemId))}
            >
              ↺ ให้นับซ้ำ
            </button>
          </div>
          <button type="button" className="mt-2 text-sm font-medium text-sky underline" onClick={() => setAdjusting(true)}>
            แก้ยอดเองพร้อมเหตุผล
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </li>
  );
}

export function ApproveMatchedButton({ countId, count }: { countId: number; count: number }) {
  const { pending, error, run } = useAction();
  return (
    <div className="safe-bottom sticky bottom-16 z-10 -mx-4 bg-paper/95 px-4 py-3 backdrop-blur">
      <button
        type="button"
        className="btn btn-primary w-full text-lg"
        disabled={pending}
        onClick={() => run(() => approveMatchedAction(countId))}
      >
        {pending ? "กำลังอนุมัติ…" : `อนุมัติ ${count} รายการที่ตรงกัน`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
