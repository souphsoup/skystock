"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { editKey, localDb, rememberSheet, type PendingEdit } from "@/client/local-db";
import { clearSyncError, fetchSheet, onSheet, scheduleSync, startSync, useSyncState } from "@/client/sync";
import { businessDate, fmtDateSlash } from "@/lib/dates";
import { expectedOf, itemLabel, type Sheet, type SheetLine } from "@/lib/types";
import { SyncBadge } from "@/components/sync-badge";
import { Stepper } from "@/components/stepper";
import { fmtQty } from "@/components/status";
import { IconBack, IconSearch } from "@/components/icons";
import { useT } from "@/i18n/client";
import { ProposeItem } from "./propose-item";

export function CountScreen({ initial }: { initial: Sheet }) {
  const [sheet, setSheet] = useState<Sheet>(initial);
  const [edits, setEdits] = useState<Map<number, PendingEdit>>(new Map());
  const [submitQueued, setSubmitQueued] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const sync = useSyncState();
  const { t } = useT();
  const cardRef = useRef<HTMLElement>(null);
  const countId = sheet.countId;

  const reloadLocal = useCallback((id: number) => {
    void readOutbox(id).then(({ edits, submitQueued }) => {
      setEdits(edits);
      setSubmitQueued(submitQueued);
    });
  }, []);

  // Start from whichever copy is newest: the server render or this device's IndexedDB.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await localDb.sheets.get(initial.locationId);
      if (cached && cached.countId === initial.countId && cached.fetchedAt > initial.fetchedAt) {
        if (alive) setSheet(cached);
      } else {
        await rememberSheet(initial);
      }
      reloadLocal(initial.countId);
    })();
    const off = onSheet((s) => {
      if (s.locationId === initial.locationId) {
        setSheet(s);
        reloadLocal(s.countId);
      }
    });
    startSync();
    return () => {
      alive = false;
      off();
    };
  }, [initial, reloadLocal]);

  // Pick up changes made elsewhere (e.g. หัวหน้าสั่งนับซ้ำ) while the screen is open.
  useEffect(() => {
    const refresh = async () => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      try {
        const s = await fetchSheet(initial.locationId);
        await rememberSheet(s);
        setSheet(s);
      } catch {}
    };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initial.locationId]);

  // Outbox changed (synced or dropped): re-read what is still pending.
  useEffect(() => {
    if (!sync.syncing) reloadLocal(countId);
  }, [sync.syncing, sync.pending, countId, reloadLocal]);

  const lines = useMemo<SheetLine[]>(
    () =>
      sheet.lines.map((l) => {
        const e = edits.get(l.itemId);
        return e && l.editable ? { ...l, inQty: e.inQty, outQty: e.outQty, counted: e.counted } : l;
      }),
    [sheet, edits],
  );

  const editable = lines.filter((l) => l.editable);
  const done = editable.filter((l) => l.counted !== null).length;
  const isRecount = sheet.status === "recount";
  const readOnly = editable.length === 0;

  const categories = useMemo(() => [...new Set(sheet.lines.map((l) => l.path[0]).filter(Boolean))], [sheet]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter(
      (l) =>
        (!isRecount || l.editable) &&
        (category === "all" || l.path[0] === category) &&
        (!q || l.nameTh.toLowerCase().includes(q) || l.nameEn.toLowerCase().includes(q)),
    );
  }, [lines, category, query, isRecount]);

  const selected =
    lines.find((l) => l.itemId === selectedId) ??
    visible.find((l) => l.editable && l.counted === null) ??
    visible[0] ??
    null;

  async function update(line: SheetLine, patch: Partial<Pick<SheetLine, "inQty" | "outQty" | "counted">>) {
    const next = { ...line, ...patch };
    // ถ้าแก้ in/out หลังยืนยันยอดแล้ว ต้องยืนยันใหม่ (ยกเว้น blind / นับครั้งแรก ที่กรอกยอดเอง)
    if (("inQty" in patch || "outQty" in patch) && !("counted" in patch) && line.opening !== null) {
      next.counted = null;
    }
    const edit: PendingEdit = {
      key: editKey(countId, line.itemId),
      countId,
      itemId: line.itemId,
      inQty: next.inQty,
      outQty: next.outQty,
      counted: next.counted,
      updatedAt: Date.now(),
    };
    setEdits((m) => new Map(m).set(line.itemId, edit));
    await localDb.edits.put(edit);
    scheduleSync();
  }

  function goNext(after: SheetLine) {
    const idx = visible.findIndex((l) => l.itemId === after.itemId);
    const rest = [...visible.slice(idx + 1), ...visible.slice(0, idx)];
    const next = rest.find((l) => l.editable && l.counted === null && l.itemId !== after.itemId);
    setSelectedId(next?.itemId ?? after.itemId);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit() {
    await localDb.submits.put({ countId, at: Date.now() });
    setSubmitQueued(true);
    scheduleSync(0);
  }

  const staleDay = sheet.businessDate !== businessDate();

  return (
    <div className="mx-auto max-w-xl pb-32">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 px-4 pt-3 pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="btn btn-ghost -ml-3 min-h-11 px-2" aria-label={t("กลับหน้าแรก")}>
            <IconBack />
          </Link>
          <h1 className="flex-1 truncate text-lg font-bold">
            {sheet.locationName} · <span className="num font-medium">{fmtDateSlash(sheet.businessDate)}</span>
          </h1>
          <SyncBadge />
        </div>
        {!readOnly && (
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">{isRecount ? t("นับซ้ำแล้ว") : t("นับแล้ว")}</span>
              <span className="num font-semibold">
                {t("{done} จาก {total}", { done, total: editable.length })}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / Math.max(1, editable.length)) * 100}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="px-4 pt-3">
        {staleDay && (
          <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
            {t("ข้อมูลนี้เป็นของวันที่ {date} เปิดหน้านี้ใหม่เมื่อมีสัญญาณเพื่อเริ่มรอบนับวันนี้", {
              date: fmtDateSlash(sheet.businessDate),
            })}
          </p>
        )}
        {sync.error && (
          <div role="alert" className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
            <span>{t(sync.error.text, sync.error.params)}</span>
            <button type="button" className="font-semibold underline" onClick={clearSyncError}>
              {t("ปิด")}
            </button>
          </div>
        )}
        {isRecount && (
          <p className="mb-3 rounded-xl border border-bad bg-bad-soft px-3 py-2 font-semibold text-bad">
            ↺ {t("หัวหน้าขอให้นับซ้ำ {n} รายการ นับของจริงแล้วส่งอีกครั้ง", { n: editable.length })}
          </p>
        )}
        {sheet.status === "submitted" && (
          <p className="mb-3 rounded-xl bg-sky-soft px-3 py-2 font-semibold text-sky">◔ {t("ส่งยอดแล้ว รอหัวหน้าตรวจ")}</p>
        )}
        {sheet.status === "approved" && (
          <p className="mb-3 rounded-xl bg-ok-soft px-3 py-2 font-semibold text-ok">✓ {t("หัวหน้าอนุมัติยอดรอบนี้แล้ว")}</p>
        )}

        {!isRecount && categories.length > 1 && (
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t("หมวด")}>
            {["all", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={`pill min-h-10 shrink-0 border px-4 text-sm ${
                  category === c ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted"
                }`}
              >
                {c === "all" ? t("ทั้งหมด") : c}
              </button>
            ))}
          </div>
        )}

        {!readOnly && selected && selected.editable && (
          <LineCard
            ref={cardRef}
            key={selected.itemId}
            line={selected}
            onChange={(patch) => update(selected, patch)}
            onDone={(counted) => {
              void update(selected, { counted });
              goNext(selected);
            }}
          />
        )}

        <label className="relative mb-3 block">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" width={18} height={18} />
          <input
            className="input pl-10"
            placeholder={t("ค้นหา ไทย / English")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("ค้นหารายการ")}
          />
        </label>

        <ul className="card divide-y divide-line" aria-label={t("รายการในใบนับ")}>
          {visible.map((l) => (
            <li key={l.itemId}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(l.itemId);
                  cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                disabled={!l.editable}
                aria-current={selected?.itemId === l.itemId && !readOnly ? "true" : undefined}
                className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left ${
                  selected?.itemId === l.itemId && !readOnly ? "bg-accent-soft" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{itemLabel(l)}</span>
                  <span className="block truncate text-sm text-muted">
                    {l.nameTh} · {l.unit}
                    {l.blind && " · Blind"}
                  </span>
                </span>
                <LineState line={l} />
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="px-4 py-6 text-center text-muted">{t("ไม่พบรายการ")}</li>}
        </ul>

        <ProposeItem
          locationId={sheet.locationId}
          lines={sheet.lines}
          proposals={sheet.proposals ?? []}
          query={query}
          onSent={() => setQuery("")}
          onPick={(id) => {
            setQuery("");
            setSelectedId(id);
            cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      {!readOnly && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 py-3">
            {submitQueued ? (
              <p className="text-center font-semibold text-sky" role="status">
                {sync.online ? t("กำลังส่งยอด…") : t("ส่งยอดไว้แล้ว ระบบจะส่งให้เองเมื่อกลับมาออนไลน์")}
              </p>
            ) : (
              <button type="button" className="btn btn-primary w-full text-lg" disabled={done < editable.length} onClick={submit}>
                {done < editable.length
                  ? t("ยังเหลือ {n} รายการ", { n: editable.length - done })
                  : isRecount
                    ? t("ส่งยอดนับซ้ำ")
                    : t("ส่งยอดให้หัวหน้าตรวจ")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function readOutbox(countId: number) {
  const list = await localDb.edits.where("countId").equals(countId).toArray();
  return {
    edits: new Map(list.map((e) => [e.itemId, e])),
    submitQueued: !!(await localDb.submits.get(countId)),
  };
}

function LineState({ line }: { line: SheetLine }) {
  const { t } = useT();
  if (line.status === "recount" && line.counted === null) return <span className="pill bg-bad-soft text-bad">↺ {t("นับซ้ำ")}</span>;
  if (line.counted === null) return <span className="pill bg-sky-soft text-sky">○ {t("ยังไม่นับ")}</span>;
  if (line.counted <= 0) return <span className="pill bg-bad-soft text-bad">{t("หมด")} · 0</span>;
  const low = line.par > 0 && line.counted < line.par;
  return (
    <span className={`num shrink-0 text-lg font-semibold ${low ? "text-warn" : ""}`}>
      {low && <span className="mr-1 text-xs font-sans">{t("ต่ำกว่า Par")}</span>}
      {fmtQty(line.counted)}
    </span>
  );
}

function LineCard({
  line,
  onChange,
  onDone,
  ref,
}: {
  line: SheetLine;
  onChange: (patch: Partial<Pick<SheetLine, "inQty" | "outQty" | "counted">>) => void;
  onDone: (counted: number) => void;
  ref: React.Ref<HTMLElement>;
}) {
  const { t } = useT();
  const expected = expectedOf(line);
  // Blind count and first-ever counts have no system figure: always type the real count.
  const manualOnly = expected === null;
  const [editing, setEditing] = useState(manualOnly);
  const [text, setText] = useState(line.counted !== null ? String(line.counted) : expected !== null ? String(Math.max(0, expected)) : "");
  const parsed = text.trim() === "" ? NaN : Number(text.replace(",", "."));
  const validManual = Number.isFinite(parsed) && parsed >= 0;

  return (
    <section ref={ref} className="card mb-4 scroll-mt-32 p-4" aria-label={t("นับ {name}", { name: itemLabel(line) })}>
      {line.path.length > 0 && <p className="text-sm text-muted">{line.path.join(" › ")}</p>}
      <div className="mt-0.5 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{itemLabel(line)}</h2>
          <p className="text-sm text-muted">{line.nameTh}</p>
        </div>
        <span className="pill shrink-0 bg-sky-soft text-sky">{t("หน่วย: {unit}", { unit: line.unit })}</span>
      </div>

      <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm">
        {line.blind ? (
          <>
            <b>Blind count</b> · {t("นับของจริงแล้วกรอกยอด ระบบจะไม่แสดงยอดที่ควรเหลือ")}
          </>
        ) : line.opening === null ? (
          <>
            <b>{t("นับครั้งแรก")}</b> · {t("ยังไม่มียอดยกมา กรอกยอดที่นับได้เป็นยอดตั้งต้น")}
          </>
        ) : (
          <>
            {t("ยกมาจากรอบก่อน")} <b className="num text-base">{fmtQty(line.opening)}</b>
          </>
        )}
      </p>

      <div className="mt-3 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <span>
            <b className="block">{t("รับเข้า")}</b>
            <span className="text-sm text-muted">
              in
              {line.mvIn > 0 && <span className="block text-ok">{t("บันทึกรับ/โอนเข้า {n} · + เพิ่มเอง", { n: fmtQty(line.mvIn) })}</span>}
            </span>
          </span>
          <Stepper label={t("รับเข้า")} value={line.inQty} onChange={(inQty) => onChange({ inQty })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>
            <b className="block">{t("เบิกออก")}</b>
            <span className="text-sm text-muted">
              out
              {line.mvOut > 0 && <span className="block text-sky">{t("บันทึกเบิก/โอน/เสีย {n} · + เพิ่มเอง", { n: fmtQty(line.mvOut) })}</span>}
            </span>
          </span>
          <Stepper label={t("เบิกออก")} value={line.outQty} onChange={(outQty) => onChange({ outQty })} />
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-end justify-between gap-2">
          <span>
            <b className="block">{t("คงเหลือ")}</b>
            <span className="text-sm text-muted">total</span>
          </span>
          {expected !== null && (
            <span className="text-right">
              <span className="num block text-sm text-muted">
                {fmtQty(line.opening)} + {fmtQty(line.mvIn + line.inQty)} − {fmtQty(line.mvOut + line.outQty)} {t("ระบบคิดให้")}
              </span>
              <span className={`num text-3xl font-bold ${expected < 0 ? "text-bad" : ""}`}>{fmtQty(expected)}</span>
            </span>
          )}
        </div>
        {expected !== null && expected < 0 && (
          <p className="mt-2 text-sm text-bad">{t("เบิกออกมากกว่าของที่มี ตรวจตัวเลข in / out อีกครั้ง")}</p>
        )}

        {line.counted !== null && !editing && (
          <p className="mt-2 text-sm font-semibold text-ok" role="status">
            ✓ {t("บันทึกแล้ว {qty} {unit}", { qty: fmtQty(line.counted), unit: line.unit })}
            {expected !== null &&
              line.counted !== expected &&
              ` ${t("(ต่างจากที่ระบบคิด {diff})", { diff: fmtQty(line.counted - expected) })}`}
          </p>
        )}

        {editing ? (
          <div className="mt-3 flex gap-2">
            <input
              className="input num flex-1 text-xl font-semibold"
              inputMode="decimal"
              aria-label={t("ยอดที่นับได้จริง")}
              placeholder={t("นับได้จริง")}
              value={text}
              autoFocus={!manualOnly}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && validManual) onDone(Math.round(parsed * 100) / 100);
              }}
            />
            {!manualOnly && (
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                {t("ยกเลิก")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!validManual}
              onClick={() => onDone(Math.round(parsed * 100) / 100)}
            >
              {t("บันทึก")}
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setText(String(line.counted ?? Math.max(0, expected ?? 0)));
                setEditing(true);
              }}
            >
              {t("แก้ยอด")}
            </button>
            <button
              type="button"
              className="btn btn-ok text-lg"
              disabled={expected === null || expected < 0}
              onClick={() => expected !== null && onDone(expected)}
            >
              ✓ {t("ตรงกับของจริง")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
