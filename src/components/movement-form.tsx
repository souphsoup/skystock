"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { localDb } from "@/client/local-db";
import { compressPhoto } from "@/client/photo";
import { clearSyncError, scheduleSync, startSync, useSyncState } from "@/client/sync";
import { KIND_LABEL, WASTE_REASONS, type MoveKind } from "@/lib/movement-types";
import type { PickItem } from "@/lib/movement-page";
import { SyncBadge } from "./sync-badge";
import { Stepper } from "./stepper";
import { IconBack, IconSearch } from "./icons";

interface Loc {
  id: number;
  name: string;
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`pill min-h-11 border px-4 text-[15px] disabled:opacity-40 ${
            value === o.value ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SUBMIT_LABEL: Record<MoveKind, string> = {
  receive: "บันทึกรับของ",
  issue: "บันทึกเบิก",
  transfer: "บันทึกโอน",
  waste: "บันทึกของเสีย",
};

export function MovementForm({
  kinds,
  locations,
  items,
}: {
  kinds: MoveKind[]; // more than one = segmented switch (เบิก | โอน)
  locations: Loc[];
  items: PickItem[];
}) {
  const sync = useSyncState();
  useEffect(() => startSync(), []);

  const withItems = locations.filter((l) => items.some((i) => i.locationId === l.id));
  const [kind, setKind] = useState<MoveKind>(kinds[0]);
  const [locationId, setLocationId] = useState<number | null>(withItems[0]?.id ?? null);
  const [toLocationId, setToLocationId] = useState<number | null>(null);
  const [lines, setLines] = useState<Map<number, number>>(new Map());
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const here = useMemo(() => items.filter((i) => i.locationId === locationId), [items, locationId]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const q = query.trim().toLowerCase();
  const choices = here.filter(
    (i) => !lines.has(i.id) && (!q || i.nameTh.toLowerCase().includes(q) || i.nameEn.toLowerCase().includes(q)),
  );

  const needsReason = kind === "waste";
  const ready =
    lines.size > 0 &&
    locationId !== null &&
    (kind !== "transfer" || (toLocationId !== null && toLocationId !== locationId)) &&
    (!needsReason || (reason !== null && (reason !== "other" || note.trim() !== "")));

  function changeLocation(id: number) {
    setLocationId(id);
    setLines(new Map());
    if (toLocationId === id) setToLocationId(null);
  }

  function setQty(id: number, qty: number) {
    setLines((m) => {
      const n = new Map(m);
      if (qty <= 0) n.delete(id);
      else n.set(id, qty);
      return n;
    });
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    const blob = await compressPhoto(file);
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(blob);
    setPreview(URL.createObjectURL(blob));
  }

  async function save() {
    if (!ready || locationId === null) return;
    setBusy(true);
    const clientId = crypto.randomUUID();
    const locName = locations.find((l) => l.id === locationId)?.name ?? "";
    const label = `${KIND_LABEL[kind]} ${lines.size} รายการ (${locName})`;
    await localDb.moves.put({
      clientId,
      label,
      photo,
      payload: {
        clientId,
        kind,
        locationId,
        toLocationId: kind === "transfer" ? toLocationId : null,
        supplier: kind === "receive" ? supplier : undefined,
        reason: kind === "waste" ? (reason ?? undefined) : undefined,
        note,
        recordedAt: Date.now(),
        lines: [...lines].map(([itemId, qty]) => ({ itemId, qty })),
      },
    });
    scheduleSync(0);
    setSaved(navigator.onLine ? `${label} บันทึกแล้ว` : `${label} บันทึกในเครื่องแล้ว จะส่งให้เองเมื่อมีสัญญาณ`);
    setLines(new Map());
    setSupplier("");
    setNote("");
    setReason(null);
    setPhoto(null);
    setPreview(null);
    setQuery("");
    setBusy(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const title = kinds.length > 1 ? "เบิก / โอน" : KIND_LABEL[kind];

  return (
    <main className="mx-auto max-w-xl px-4 pt-4 pb-40">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href="/" className="btn btn-ghost -ml-3 min-h-11 px-2" aria-label="กลับหน้าแรก">
            <IconBack />
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <SyncBadge />
      </header>

      {saved && (
        <p role="status" className="mb-4 flex items-start justify-between gap-2 rounded-xl bg-ok-soft px-3 py-2 font-semibold text-ok">
          <span>✓ {saved}</span>
          <Link href="/movements" className="shrink-0 text-sm underline">
            ดูประวัติ
          </Link>
        </p>
      )}
      {sync.error && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          <span>{sync.error}</span>
          <button type="button" className="font-semibold underline" onClick={clearSyncError}>
            ปิด
          </button>
        </div>
      )}

      <div className="grid gap-5">
        {kinds.length > 1 && (
          <div className="grid grid-cols-2 rounded-xl border border-line bg-surface p-1" role="tablist">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-11 rounded-lg font-semibold ${kind === k ? "bg-accent text-accent-ink" : "text-muted"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        <fieldset>
          <legend className="mb-2 font-semibold">{kind === "receive" ? "เก็บที่" : kind === "transfer" ? "โอนจาก" : "จาก"}</legend>
          <Chips label="จุดเก็บ" value={locationId} onChange={changeLocation} options={withItems.map((l) => ({ value: l.id, label: l.name }))} />
        </fieldset>

        {kind === "transfer" && (
          <fieldset>
            <legend className="mb-2 font-semibold">ไปที่</legend>
            <Chips
              label="จุดปลายทาง"
              value={toLocationId}
              onChange={setToLocationId}
              options={locations.map((l) => ({ value: l.id, label: l.name, disabled: l.id === locationId }))}
            />
            <p className="mt-2 text-sm text-muted">ถ้าปลายทางยังไม่มีรายการนี้ ระบบจะเพิ่มให้เอง (Par เริ่มที่ 0)</p>
          </fieldset>
        )}

        {kind === "issue" && <p className="-mt-2 text-sm text-muted">เบิกของออกไปใช้ในครัวหรือบาร์ ยอดจะไปอยู่ช่อง out ของใบนับ</p>}

        {kind === "waste" && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-semibold">สาเหตุ</legend>
            <Chips
              label="สาเหตุ"
              value={reason}
              onChange={setReason}
              options={Object.entries(WASTE_REASONS).map(([value, label]) => ({ value, label }))}
            />
          </fieldset>
        )}

        {(kind === "receive" || kind === "waste") && (
          <div className="grid gap-2">
            <span className="font-semibold">
              {kind === "receive" ? "รูปใบส่งของ" : "รูปของเสีย"} <span className="font-normal text-muted">(ไม่บังคับ)</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
            {preview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={preview} alt="รูปที่ถ่ายไว้" className="h-24 w-24 rounded-xl border border-line object-cover" />
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                  ถ่ายใหม่
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-bad"
                  onClick={() => {
                    setPhoto(null);
                    setPreview(null);
                  }}
                >
                  ลบรูป
                </button>
              </div>
            ) : (
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                📷 ถ่ายรูป
              </button>
            )}
          </div>
        )}

        {kind === "receive" && (
          <label className="grid gap-1.5">
            <span className="font-semibold">
              ซัพพลายเออร์ <span className="font-normal text-muted">(ไม่บังคับ)</span>
            </span>
            <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="เช่น Makro, ฟาร์มกุ้ง" />
          </label>
        )}

        {lines.size > 0 && (
          <section aria-labelledby="picked">
            <h2 id="picked" className="mb-2 font-semibold">
              รายการที่เลือก ({lines.size})
            </h2>
            <ul className="card divide-y divide-line">
              {[...lines].map(([id, qty]) => {
                const it = byId.get(id)!;
                return (
                  <li key={id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <b className="block truncate">{it.nameEn || it.nameTh}</b>
                      <span className="text-sm text-muted">
                        {it.nameTh} · {it.unit}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Stepper label={`จำนวน ${it.nameTh}`} value={qty} onChange={(v) => setQty(id, v)} />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-muted">ลดเหลือ 0 เพื่อเอารายการออก</p>
          </section>
        )}

        <section aria-labelledby="choose">
          <h2 id="choose" className="mb-2 font-semibold">
            เลือกรายการ
          </h2>
          <label className="relative mb-2 block">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" width={18} height={18} />
            <input className="input pl-10" placeholder="ค้นหา ไทย / English" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="ค้นหารายการ" />
          </label>
          <ul className="card divide-y divide-line">
            {choices.map((i) => (
              <li key={i.id}>
                <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left" onClick={() => setQty(i.id, 1)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {i.nameEn || i.nameTh} <span className="text-muted">· {i.nameTh}</span>
                    </span>
                    {i.path && <span className="block truncate text-xs text-muted">{i.path}</span>}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-accent">+ {i.unit}</span>
                </button>
              </li>
            ))}
            {choices.length === 0 && <li className="px-4 py-5 text-center text-muted">ไม่พบรายการ</li>}
          </ul>
        </section>

        <label className="grid gap-1.5">
          <span className="font-semibold">
            หมายเหตุ {kind === "waste" && reason === "other" ? "" : <span className="font-normal text-muted">(ไม่บังคับ)</span>}
          </span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-10 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3">
          <button type="button" className="btn btn-primary w-full text-lg" disabled={!ready || busy} onClick={() => void save()}>
            {lines.size === 0 ? "เลือกรายการก่อน" : `${SUBMIT_LABEL[kind]} (${lines.size} รายการ)`}
          </button>
        </div>
      </div>
    </main>
  );
}
