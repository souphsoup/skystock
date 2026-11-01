"use client";

import { useEffect, useMemo, useState } from "react";
import { localDb, type PendingProposal } from "@/client/local-db";
import { scheduleSync, useSyncState } from "@/client/sync";
import { DEFAULT_UNITS } from "@/lib/catalog-tree";
import type { SheetProposal } from "@/lib/proposal-types";
import { itemLabel, type SheetLine } from "@/lib/types";
import { fmtQty } from "@/components/status";
import { useT } from "@/i18n/client";

const THAI = /[฀-๿]/;

/**
 * "ไม่มีในใบนับ?" — staff propose an item that is on the shelf but not on the sheet.
 * Saved on the device first (works offline); the supervisor approves it into a real item.
 */
export function ProposeItem({
  locationId,
  lines,
  proposals,
  query,
  onPick,
  onSent,
}: {
  locationId: number;
  lines: SheetLine[];
  proposals: SheetProposal[];
  query: string;
  onPick: (itemId: number) => void;
  onSent: () => void;
}) {
  const { t } = useT();
  const sync = useSyncState();
  const [open, setOpen] = useState(false);
  const [queued, setQueued] = useState<PendingProposal[]>([]);
  const [sent, setSent] = useState<string | null>(null);

  // Proposals still in this device's outbox
  useEffect(() => {
    let alive = true;
    void localDb.proposals.toArray().then((list) => {
      if (alive) setQueued(list.filter((p) => p.payload.locationId === locationId));
    });
    return () => {
      alive = false;
    };
  }, [locationId, sync.pending, sync.syncing, open]);

  const q = query.trim();
  return (
    <section className="mt-4" aria-label={t("รายการที่ยังไม่มีในใบนับ")}>
      {(proposals.length > 0 || queued.length > 0) && (
        <ul className="card mb-3 divide-y divide-line text-sm">
          {queued.map((p) => (
            <ProposalRow
              key={p.clientId}
              name={p.payload.nameEn || p.payload.nameTh}
              sub={p.payload.nameEn ? p.payload.nameTh : null}
              qty={p.payload.counted}
              unit={p.payload.unit}
              state={<span className="pill bg-sky-soft text-sky">{t("รอส่ง")}</span>}
            />
          ))}
          {proposals.map((p) => (
            <ProposalRow
              key={p.id}
              name={p.nameEn || p.nameTh}
              sub={[p.nameEn ? p.nameTh : null, p.by].filter(Boolean).join(" · ")}
              qty={p.counted}
              unit={p.unit}
              note={p.status === "rejected" && p.rejectReason ? t("เหตุผล: {reason}", { reason: p.rejectReason }) : null}
              state={
                p.status === "pending" ? (
                  <span className="pill bg-warn-soft text-warn">{t("รอหัวหน้าอนุมัติ")}</span>
                ) : p.status === "approved" ? (
                  <span className="pill bg-ok-soft text-ok">{t("อนุมัติแล้ว")}</span>
                ) : (
                  <span className="pill bg-bad-soft text-bad">{t("ไม่อนุมัติ")}</span>
                )
              }
            />
          ))}
        </ul>
      )}

      {sent && (
        <p role="status" className="mb-3 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
          {sent}
        </p>
      )}

      {open ? (
        <ProposeForm
          locationId={locationId}
          lines={lines}
          initialName={q}
          onPick={(id) => {
            setOpen(false);
            onPick(id);
          }}
          onCancel={() => setOpen(false)}
          onQueued={(name) => {
            setOpen(false);
            onSent();
            setSent(
              navigator.onLine
                ? t("ส่ง {name} ให้หัวหน้าแล้ว รายการจะเข้าใบนับเมื่อหัวหน้าอนุมัติ", { name })
                : t("บันทึก {name} ในเครื่องแล้ว จะส่งให้หัวหน้าเองเมื่อมีสัญญาณ", { name }),
            );
          }}
        />
      ) : (
        <button
          type="button"
          className="btn w-full border-dashed text-hl"
          onClick={() => {
            setSent(null);
            setOpen(true);
          }}
        >
          {q ? t("+ ไม่เจอ \"{q}\"? เสนอเป็นรายการใหม่", { q }) : t("+ มีของที่ไม่อยู่ในใบนับ? เสนอรายการใหม่")}
        </button>
      )}
    </section>
  );
}

function ProposalRow({
  name,
  sub,
  qty,
  unit,
  note,
  state,
}: {
  name: string;
  sub: string | null;
  qty: number | null;
  unit: string;
  note?: string | null;
  state: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2.5">
      <span className="min-w-0">
        <b className="block truncate">{name}</b>
        <span className="block truncate text-muted">
          {[sub, qty !== null ? `${fmtQty(qty)} ${unit}` : unit].filter(Boolean).join(" · ")}
        </span>
        {note && <span className="block text-bad">{note}</span>}
      </span>
      {state}
    </li>
  );
}

function ProposeForm({
  locationId,
  lines,
  initialName,
  onPick,
  onCancel,
  onQueued,
}: {
  locationId: number;
  lines: SheetLine[];
  initialName: string;
  onPick: (itemId: number) => void;
  onCancel: () => void;
  onQueued: (name: string) => void;
}) {
  const { t } = useT();
  const [nameTh, setNameTh] = useState(THAI.test(initialName) ? initialName : "");
  const [nameEn, setNameEn] = useState(THAI.test(initialName) ? "" : initialName);
  const [unit, setUnit] = useState("");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const units = useMemo(() => [...new Set([...DEFAULT_UNITS, ...lines.map((l) => l.unit)])], [lines]);
  // Already on the sheet under another spelling? Offer it before a duplicate gets proposed.
  const similar = useMemo(() => {
    const needles = [nameTh, nameEn].map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2);
    if (!needles.length) return [];
    return lines
      .filter((l) => needles.some((n) => l.nameTh.toLowerCase().includes(n) || l.nameEn.toLowerCase().includes(n)))
      .slice(0, 3);
  }, [lines, nameTh, nameEn]);

  const qty = counted.trim() === "" ? null : Number(counted);
  const valid = (nameTh.trim() || nameEn.trim()) && unit.trim() && (qty === null || (Number.isFinite(qty) && qty >= 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const clientId = crypto.randomUUID();
    // Thai name is the item's main name; if staff only know the English one, use it for both.
    const th = nameTh.trim() || nameEn.trim();
    await localDb.proposals.put({
      clientId,
      payload: {
        clientId,
        locationId,
        nameTh: th,
        nameEn: nameEn.trim(),
        unit: unit.trim(),
        counted: qty,
        note: note.trim(),
        recordedAt: Date.now(),
      },
    });
    scheduleSync(0);
    onQueued(nameEn.trim() || th);
  }

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4">
      <h2 className="font-semibold">{t("เสนอรายการใหม่")}</h2>
      <p className="-mt-2 text-sm text-muted">{t("หัวหน้าจะตรวจและตั้งหมวด Par ราคาทุน แล้วรายการจะเข้าใบนับ")}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">{t("ชื่อไทย")}</span>
          <input className="input" value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder={t("เช่น ซอสพริก")} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">{t("ชื่ออังกฤษ")}</span>
          <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Chili sauce" />
        </label>
      </div>

      {similar.length > 0 && (
        <div className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
          <b className="block">{t("มีในใบนับแล้วหรือเปล่า?")}</b>
          <div className="mt-1 flex flex-wrap gap-2">
            {similar.map((l) => (
              <button key={l.itemId} type="button" className="pill min-h-10 border border-warn/40 bg-surface px-3 text-ink" onClick={() => onPick(l.itemId)}>
                {t("นับ {name}", { name: itemLabel(l) })}
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm text-muted">{t("หน่วยนับ")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("หน่วยนับ")}>
          {units.map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => setUnit(u)}
              className={`pill min-h-10 border px-3 text-[15px] ${unit === u ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink"}`}
            >
              {u}
            </button>
          ))}
        </div>
        <input
          className="input"
          value={units.includes(unit) ? "" : unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder={t("หรือพิมพ์หน่วยอื่น")}
          aria-label={t("หน่วยอื่น")}
        />
      </fieldset>

      <label className="grid gap-1 text-sm">
        <span className="text-muted">{t("นับได้ตอนนี้ (ไม่บังคับ)")}</span>
        <input
          className="input num"
          inputMode="decimal"
          value={counted}
          onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{t("หมายเหตุถึงหัวหน้า (ไม่บังคับ)")}</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("เช่น ของใหม่จากซัพพลายเออร์")} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={onCancel}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
          {t("ส่งให้หัวหน้า")}
        </button>
      </div>
    </form>
  );
}
