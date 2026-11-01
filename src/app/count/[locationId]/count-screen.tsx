"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { editKey, localDb, rememberSheet, type PendingComment, type PendingEdit } from "@/client/local-db";
import { clearSyncError, fetchSheet, onSheet, scheduleSync, startSync, useSyncState } from "@/client/sync";
import { businessDate, fmtDateSlash } from "@/lib/dates";
import { expectedOf, itemLabel, type Sheet, type SheetLine } from "@/lib/types";
import { SyncBadge } from "@/components/sync-badge";
import { Stepper } from "@/components/stepper";
import { fmtQty } from "@/components/status";
import { IconBack, IconSearch } from "@/components/icons";
import { useT } from "@/i18n/client";
import { CommentThread } from "@/components/comment-thread";
import { ProposeItem } from "./propose-item";

export function CountScreen({ initial }: { initial: Sheet }) {
  const [sheet, setSheet] = useState<Sheet>(initial);
  const [edits, setEdits] = useState<Map<number, PendingEdit>>(new Map());
  const [submitQueued, setSubmitQueued] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  // บันทึกจากคีย์บอร์ด → รายการถัดไปเปิดช่องกรอกค้างไว้ คีย์บอร์ดไม่ต้องหุบ/เด้งใหม่
  const [keypad, setKeypad] = useState(false);
  const [queuedComments, setQueuedComments] = useState<PendingComment[]>([]);
  // The figure just saved, shown in the header so a typo can be caught after the card moves on.
  const [lastSaved, setLastSaved] = useState<{ itemId: number; qty: number } | null>(null);
  const [reviewing, setReviewing] = useState(false);
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

  // Messages typed on this device that have not reached the server yet
  useEffect(() => {
    void readQueuedComments(countId).then(setQueuedComments);
  }, [countId, sync.syncing, sync.pending]);

  /** Saved on the device first (works with no signal), then sent by the sync loop. */
  async function sendComment(itemId: number | null, body: string): Promise<string | null> {
    const clientId = crypto.randomUUID();
    await localDb.comments.put({ clientId, countId, locationId: sheet.locationId, payload: { clientId, itemId, body }, at: Date.now() });
    setQueuedComments(await readQueuedComments(countId));
    scheduleSync(0);
    return null;
  }

  const comments = sheet.comments ?? [];
  const queued = queuedComments.map((c) => ({ key: c.clientId, itemId: c.payload.itemId, body: c.payload.body }));
  const messagesAbout = (itemId: number) =>
    comments.filter((c) => c.itemId === itemId).length + queued.filter((q) => q.itemId === itemId).length;

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

  function goNext(after: SheetLine, keepKeyboard: boolean) {
    const idx = visible.findIndex((l) => l.itemId === after.itemId);
    const rest = [...visible.slice(idx + 1), ...visible.slice(0, idx)];
    const next = rest.find((l) => l.editable && l.counted === null && l.itemId !== after.itemId);
    setSelectedId(next?.itemId ?? after.itemId);
    setKeypad(keepKeyboard && !!next);
    if (!keepKeyboard) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // นับครบแล้ว: หุบคีย์บอร์ดให้เห็นปุ่มส่งยอด
    else if (!next) (document.activeElement as HTMLElement | null)?.blur();
  }

  function pick(id: number) {
    setKeypad(false);
    setSelectedId(id);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Lines worth a second look before sending: a figure that differs from what the system worked
  // out (non-blind only; blind lines have no figure here), or one that looks like a typo.
  const toCheck = useMemo(
    () =>
      lines
        .filter((l) => l.editable && l.counted !== null)
        .map((l) => {
          const expected = expectedOf(l);
          return { line: l, expected, high: looksTooHigh(l.counted!, l), diff: expected === null ? 0 : l.counted! - expected };
        })
        .filter((x) => x.high || x.diff !== 0)
        .sort((a, b) => Number(b.high) - Number(a.high) || Math.abs(b.diff) - Math.abs(a.diff)),
    [lines],
  );

  async function submit() {
    if (toCheck.length > 0 && !reviewing) {
      setReviewing(true);
      return;
    }
    setReviewing(false);
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
              {lastSaved && lines.some((l) => l.itemId === lastSaved.itemId && l.editable) ? (
                <button
                  type="button"
                  className="-my-1.5 min-w-0 truncate py-1.5 text-left text-ok"
                  onClick={() => pick(lastSaved.itemId)}
                >
                  ✓ {itemLabel(lines.find((x) => x.itemId === lastSaved.itemId)!)}{" "}
                  <span className="num font-semibold">{fmtQty(lastSaved.qty)}</span>{" "}
                  {lines.find((x) => x.itemId === lastSaved.itemId)!.unit} ·{" "}
                  <span className="font-semibold underline">{t("แก้")}</span>
                </button>
              ) : (
                <span className="text-muted">{isRecount ? t("นับซ้ำแล้ว") : t("นับแล้ว")}</span>
              )}
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
            keypad={keypad}
            onChange={(patch) => update(selected, patch)}
            onDone={(counted, keepKeyboard) => {
              // Render the next card and focus its input inside this tap, so the keyboard stays up.
              void update(selected, { counted });
              setLastSaved({ itemId: selected.itemId, qty: counted });
              flushSync(() => goNext(selected, keepKeyboard));
            }}
          />
        )}
        {!readOnly && selected && selected.editable && (
          <CommentThread
            key={`c${selected.itemId}`}
            className="card -mt-2 mb-4 px-4 py-1 pb-3"
            title={t("ข้อความเรื่อง {name}", { name: itemLabel(selected) })}
            comments={comments.filter((c) => c.itemId === selected.itemId)}
            queued={queued.filter((q) => q.itemId === selected.itemId)}
            placeholder={t("เช่น ของอยู่อีกตู้ นับรวมแล้ว")}
            onSend={(body) => sendComment(selected.itemId, body)}
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
                  setKeypad(false);
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
                  <span className="block truncate font-semibold">
                    {itemLabel(l)}
                    {messagesAbout(l.itemId) > 0 && (
                      <span className="ml-1.5 text-sm font-normal text-sky" aria-label={t("ข้อความ {n}", { n: messagesAbout(l.itemId) })}>
                        💬 {messagesAbout(l.itemId)}
                      </span>
                    )}
                  </span>
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

        <CommentThread
          className="card mt-4 px-4 py-1 pb-3"
          title={t("ข้อความในรอบนับนี้")}
          comments={comments}
          queued={queued}
          itemName={(id) => {
            const l = sheet.lines.find((x) => x.itemId === id);
            return l && itemLabel(l);
          }}
          placeholder={t("ฝากข้อความถึงหัวหน้า")}
          onSend={(body) => sendComment(null, body)}
        />

        <ProposeItem
          locationId={sheet.locationId}
          lines={sheet.lines}
          proposals={sheet.proposals ?? []}
          query={query}
          onSent={() => setQuery("")}
          onPick={(id) => {
            setQuery("");
            pick(id);
          }}
        />
      </div>

      {/* Hidden until every line is counted: on a short phone it would cover the count card's buttons. */}
      {!readOnly && (submitQueued || done === editable.length) && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 py-3">
            {reviewing && !submitQueued && (
              <div className="mb-3" role="dialog" aria-labelledby="precheck-title">
                <h2 id="precheck-title" className="text-lg font-bold">
                  {t("ตรวจก่อนส่ง")}
                </h2>
                <p className="text-sm text-muted">
                  {t("{n} รายการต่างจากที่ระบบคิดหรือสูงผิดปกติ แตะเพื่อแก้ หรือส่งเลยถ้านับถูกแล้ว", { n: toCheck.length })}
                </p>
                <ul className="mt-2 max-h-[40vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {toCheck.map(({ line: l, expected, high, diff }) => (
                    <li key={l.itemId}>
                      <button
                        type="button"
                        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left"
                        onClick={() => {
                          setReviewing(false);
                          setCategory("all");
                          setQuery("");
                          pick(l.itemId);
                        }}
                      >
                        <span className="min-w-0 truncate font-semibold">{itemLabel(l)}</span>
                        <span className="num shrink-0 text-right text-sm">
                          <b className="text-base">
                            {fmtQty(l.counted!)} {l.unit}
                          </b>
                          <span className={`block ${high ? "text-warn" : "text-muted"}`}>
                            {high
                              ? t("สูงผิดปกติ")
                              : t("ระบบคิด {qty} ({diff})", { qty: fmtQty(expected!), diff: `${diff > 0 ? "+" : ""}${fmtQty(diff)}` })}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {submitQueued ? (
              <p className="text-center font-semibold text-sky" role="status">
                {sync.online ? t("กำลังส่งยอด…") : t("ส่งยอดไว้แล้ว ระบบจะส่งให้เองเมื่อกลับมาออนไลน์")}
              </p>
            ) : (
              <div className={reviewing ? "grid grid-cols-[auto_1fr] gap-2" : ""}>
                {reviewing && (
                  <button type="button" className="btn" onClick={() => setReviewing(false)}>
                    {t("กลับไปแก้")}
                  </button>
                )}
                <button type="button" className="btn btn-primary w-full text-lg" disabled={done < editable.length} onClick={submit}>
                  {reviewing ? t("ส่งเลย") : isRecount ? t("ส่งยอดนับซ้ำ") : t("ส่งยอดให้หัวหน้าตรวจ")}
                </button>
              </div>
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

async function readQueuedComments(countId: number) {
  const list = await localDb.comments.where("countId").equals(countId).toArray();
  return list.sort((a, b) => a.at - b.at);
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
  keypad,
  onChange,
  onDone,
  ref,
}: {
  line: SheetLine;
  /** มาจากการกดบันทึกด้วยคีย์บอร์ด: เปิดช่องกรอกและโฟกัสทันที */
  keypad: boolean;
  onChange: (patch: Partial<Pick<SheetLine, "inQty" | "outQty" | "counted">>) => void;
  onDone: (counted: number, keepKeyboard: boolean) => void;
  ref: React.Ref<HTMLElement>;
}) {
  const { t } = useT();
  const expected = expectedOf(line);
  // Blind count and first-ever counts have no system figure: always type the real count.
  const manualOnly = expected === null;
  const [editing, setEditing] = useState(manualOnly || keypad);
  const [text, setText] = useState(line.counted !== null ? String(line.counted) : expected !== null ? String(Math.max(0, expected)) : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = text.trim() === "" ? NaN : Number(text.replace(",", "."));
  const validManual = Number.isFinite(parsed) && parsed >= 0;
  // A figure that looks like a typo (an extra zero) waits for a second "yes" before saving.
  const [checkQty, setCheckQty] = useState<number | null>(null);
  const save = () => {
    const qty = Math.round(parsed * 100) / 100;
    if (checkQty !== qty && looksTooHigh(qty, line)) {
      setCheckQty(qty);
      return;
    }
    onDone(qty, document.activeElement === inputRef.current);
  };

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

      {/* One line per row, recorded-movement notes on their own line underneath: keeps the card
          short enough that "✓ ตรงกับของจริง" stays on screen on a 360×640 phone. */}
      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <b>
            {t("รับเข้า")} <span className="text-sm font-normal text-muted">in</span>
          </b>
          <Stepper label={t("รับเข้า")} value={line.inQty} onChange={(inQty) => onChange({ inQty })} />
        </div>
        {line.mvIn > 0 && <p className="-mt-1 text-sm text-ok">{t("บันทึกรับ/โอนเข้า {n} · + เพิ่มเอง", { n: fmtQty(line.mvIn) })}</p>}
        <div className="flex items-center justify-between gap-2">
          <b>
            {t("เบิกออก")} <span className="text-sm font-normal text-muted">out</span>
          </b>
          <Stepper label={t("เบิกออก")} value={line.outQty} onChange={(outQty) => onChange({ outQty })} />
        </div>
        {line.mvOut > 0 && <p className="-mt-1 text-sm text-sky">{t("บันทึกเบิก/โอน/เสีย {n} · + เพิ่มเอง", { n: fmtQty(line.mvOut) })}</p>}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-end justify-between gap-2">
          <b>
            {t("คงเหลือ")} <span className="text-sm font-normal text-muted">total</span>
          </b>
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

        {editing && (
          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              className="input num flex-1 text-xl font-semibold"
              inputMode="decimal"
              enterKeyHint="next"
              aria-label={t("ยอดที่นับได้จริง")}
              placeholder={t("นับได้จริง")}
              value={text}
              autoFocus={!manualOnly || keypad}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setText(e.target.value);
                setCheckQty(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && validManual) save();
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
              // Don't take focus from the input, otherwise the keyboard starts closing on tap.
              onMouseDown={(e) => e.preventDefault()}
              onClick={save}
            >
              {t("บันทึก")}
            </button>
          </div>
        )}
        {editing && checkQty !== null && (
          <div role="alert" className="mt-2 rounded-xl border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
            <p className="font-semibold">
              ⚠ {t("{qty} {unit} สูงผิดปกติ ตรวจจำนวนและหน่วยอีกครั้ง", { qty: fmtQty(checkQty), unit: line.unit })}
            </p>
            {expected !== null && <p>{t("ระบบคิดไว้ {qty} {unit}", { qty: fmtQty(expected), unit: line.unit })}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCheckQty(null);
                  inputRef.current?.focus();
                }}
              >
                {t("แก้ตัวเลข")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onDone(checkQty, false)}>
                {t("ใช่ {qty} ถูกต้อง", { qty: fmtQty(checkQty) })}
              </button>
            </div>
          </div>
        )}
        {!editing && (
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
              onClick={() => expected !== null && onDone(expected, false)}
            >
              ✓ {t("ตรงกับของจริง")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Catches typos like an extra zero (40 or 1000 typed for 4). Only "too high": a low count is an
 * ordinary variance for the supervisor. The reference is what the counter can already see (the
 * system figure, or Par + recorded/typed in for blind and first counts), so a blind item's
 * warning gives nothing away.
 */
function looksTooHigh(qty: number, line: SheetLine): boolean {
  const ref = Math.max(expectedOf(line) ?? 0, line.par + line.mvIn + line.inQty);
  if (ref <= 0) return qty >= 1000;
  return qty > ref * 5 && qty - ref >= 10;
}
