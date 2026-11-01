"use client";

// Pushes the outbox (line edits, then submits) to the server whenever we are
// online. Each edit carries the time it was made; after a successful push we
// only delete an edit if it has not been changed again in the meantime.

import { useSyncExternalStore } from "react";
import type { Sheet } from "@/lib/types";
import { tk, type Params } from "@/i18n";
import { localDb, pendingCount, rememberSheet, type PendingEdit } from "./local-db";

/** A Thai key (or a message the server already translated) plus params; translated where rendered. */
export interface SyncError {
  text: string;
  params?: Params;
}

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  error: SyncError | null;
  authRequired: boolean;
}

let state: SyncState = { online: true, syncing: false, pending: 0, error: null, authRequired: false };
const listeners = new Set<() => void>();
const sheetListeners = new Set<(s: Sheet) => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Called with every fresh sheet the server returns during sync. */
export function onSheet(fn: (s: Sheet) => void) {
  sheetListeners.add(fn);
  return () => {
    sheetListeners.delete(fn);
  };
}

class HttpFailure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpFailure(res.status, data.error ?? `HTTP ${res.status}`);
  return data as T;
}

async function receiveSheet(sheet: Sheet) {
  await rememberSheet(sheet);
  sheetListeners.forEach((l) => l(sheet));
}

async function pushEdits() {
  const edits = await localDb.edits.toArray();
  const byCount = new Map<number, PendingEdit[]>();
  for (const e of edits) byCount.set(e.countId, [...(byCount.get(e.countId) ?? []), e]);

  for (const [countId, list] of byCount) {
    try {
      const { sheet, rejected } = await post<{ sheet: Sheet; rejected: number[] }>(
        `/api/counts/${countId}/lines`,
        { lines: list.map(({ itemId, inQty, outQty, counted }) => ({ itemId, inQty, outQty, counted })) },
      );
      await localDb.transaction("rw", localDb.edits, async () => {
        for (const sent of list) {
          const cur = await localDb.edits.get(sent.key);
          if (cur && cur.updatedAt === sent.updatedAt) await localDb.edits.delete(sent.key);
        }
      });
      if (rejected.length) set({
          error: {
            text: tk("มี {n} รายการที่แก้ไม่ได้แล้ว เพราะรอบนับถูกส่งหรืออนุมัติไปแล้ว"),
            params: { n: rejected.length },
          },
        });
      await receiveSheet(sheet);
    } catch (e) {
      if (!(e instanceof HttpFailure)) throw e; // network: try again later
      if (e.status === 401) throw e;
      // The server will never accept these (bad value, count gone): drop them.
      await localDb.edits.bulkDelete(list.map((x) => x.key));
      set({ error: { text: e.message } });
    }
  }
}

async function pushSubmits() {
  for (const s of await localDb.submits.toArray()) {
    if ((await localDb.edits.where("countId").equals(s.countId).count()) > 0) continue;
    try {
      const { sheet } = await post<{ sheet: Sheet }>(`/api/counts/${s.countId}/submit`, {});
      await localDb.submits.delete(s.countId);
      await receiveSheet(sheet);
    } catch (e) {
      if (!(e instanceof HttpFailure)) throw e;
      if (e.status === 401) throw e;
      await localDb.submits.delete(s.countId);
      set({ error: { text: e.message } });
    }
  }
}

async function pushMoves() {
  for (const m of await localDb.moves.toArray()) {
    const form = new FormData();
    form.set("payload", JSON.stringify(m.payload));
    if (m.photo) form.set("photo", m.photo, "photo.jpg");
    const res = await fetch("/api/movements", { method: "POST", body: form, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await localDb.moves.delete(m.clientId);
      continue;
    }
    if (res.status === 401) throw new HttpFailure(401, data.error ?? "");
    if (res.status >= 500) throw new HttpFailure(res.status, data.error ?? ""); // retry later
    await localDb.moves.delete(m.clientId);
    set({
      error: {
        text: tk("{label}: {error} (ไม่ได้บันทึก)"),
        params: { label: m.label, error: data.error ?? `HTTP ${res.status}` },
      },
    });
  }
}

async function pushProposals() {
  for (const p of await localDb.proposals.toArray()) {
    try {
      await post("/api/proposals", p.payload);
      await localDb.proposals.delete(p.clientId);
      // Show it under the sheet as "waiting for approval"
      await fetchSheet(p.payload.locationId).then(receiveSheet, () => {});
    } catch (e) {
      if (!(e instanceof HttpFailure)) throw e; // network: try again later
      if (e.status === 401 || e.status >= 500) throw e;
      // Rejected for good (already on the sheet, already proposed…): tell the person and drop it.
      await localDb.proposals.delete(p.clientId);
      set({ error: { text: tk("{label}: {error} (ไม่ได้บันทึก)"), params: { label: p.payload.nameTh, error: e.message } } });
    }
  }
}

async function pushComments() {
  // Oldest first, so a conversation typed offline arrives in order.
  const list = (await localDb.comments.toArray()).sort((a, b) => a.at - b.at);
  const sent = new Set<number>();
  try {
    for (const c of list) {
      try {
        await post(`/api/counts/${c.countId}/comments`, c.payload);
      } catch (e) {
        if (!(e instanceof HttpFailure)) throw e; // network: try again later
        if (e.status === 401 || e.status >= 500) throw e;
        // Rejected for good (count gone, too long…): tell the person and drop it.
        set({ error: { text: tk("ข้อความ: {error} (ไม่ได้ส่ง)"), params: { error: e.message } } });
      }
      await localDb.comments.delete(c.clientId);
      sent.add(c.locationId);
    }
  } finally {
    // Show the sent messages in the thread (with the supervisor's replies so far)
    for (const locationId of sent) await fetchSheet(locationId).then(receiveSheet, () => {});
  }
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      if (!navigator.onLine) break;
      set({ syncing: true });
      try {
        // Movements first: they change in/out on the count sheet that edits and submits rely on.
        await pushMoves();
        await pushProposals();
        await pushEdits();
        await pushSubmits();
        await pushComments();
        set({ authRequired: false });
      } catch (e) {
        if (e instanceof HttpFailure && e.status === 401) set({ authRequired: true });
        break; // offline or signed out; retry on the next trigger
      } finally {
        set({ syncing: false, pending: await pendingCount() });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Debounced sync after local edits. */
export function scheduleSync(delay = 600) {
  clearTimeout(timer);
  pendingCount().then((pending) => set({ pending }));
  timer = setTimeout(() => void syncNow(), delay);
}

export function clearSyncError() {
  set({ error: null });
}

let started = false;
/** Start background triggers once per page: back online, tab visible, every 30s. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ online: navigator.onLine });
  void pendingCount().then((pending) => set({ pending }));
  window.addEventListener("online", () => {
    set({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => set({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => void syncNow(), 30_000);
  void syncNow();
}

export async function fetchSheet(locationId: number): Promise<Sheet> {
  const res = await fetch(`/api/counts/sheet?location=${locationId}`, { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) set({ authRequired: true });
  if (!res.ok) throw new HttpFailure(res.status, data.error ?? `HTTP ${res.status}`);
  return data.sheet as Sheet;
}
