"use client";

// IndexedDB on the device: the last count sheet we saw per location, plus
// edits and submits that have not reached the server yet (the outbox).

import Dexie, { type Table } from "dexie";
import type { LineInput, Sheet } from "@/lib/types";
import type { MoveInput } from "@/lib/movement-types";
import type { ProposalInput } from "@/lib/proposal-types";

export interface PendingEdit extends LineInput {
  key: string; // `${countId}:${itemId}`
  countId: number;
  updatedAt: number;
}

export interface PendingSubmit {
  countId: number;
  at: number;
}

/** A รับของ / เบิก / โอน / ของเสีย entry waiting to be sent (photo kept as a Blob). */
export interface PendingMove {
  clientId: string;
  payload: MoveInput;
  photo: Blob | null;
  label: string;
}

/** A proposed new item waiting to be sent. */
export interface PendingProposal {
  clientId: string;
  payload: ProposalInput;
}

class LocalDb extends Dexie {
  sheets!: Table<Sheet, number>; // keyed by locationId
  edits!: Table<PendingEdit, string>;
  submits!: Table<PendingSubmit, number>;
  moves!: Table<PendingMove, string>;
  proposals!: Table<PendingProposal, string>;

  constructor() {
    super("sop-stock");
    this.version(1).stores({
      sheets: "locationId",
      edits: "key, countId",
      submits: "countId",
    });
    // v2: movement outbox. Cached sheets predate mv_in/mv_out, so drop them.
    this.version(2)
      .stores({ moves: "clientId" })
      .upgrade((tx) => tx.table("sheets").clear());
    // v3: proposed-item outbox
    this.version(3).stores({ proposals: "clientId" });
  }
}

export const localDb = new LocalDb();

export const editKey = (countId: number, itemId: number) => `${countId}:${itemId}`;

/** Store a sheet from the server unless we already hold a newer copy. */
export async function rememberSheet(sheet: Sheet) {
  await localDb.transaction("rw", localDb.sheets, async () => {
    const cur = await localDb.sheets.get(sheet.locationId);
    if (!cur || cur.fetchedAt <= sheet.fetchedAt) await localDb.sheets.put(sheet);
  });
}

export async function pendingCount(): Promise<number> {
  return (
    (await localDb.edits.count()) +
    (await localDb.submits.count()) +
    (await localDb.moves.count()) +
    (await localDb.proposals.count())
  );
}

/** On logout from a shared tablet: forget cached sheets. Pending work is kept
 * (logout is blocked while anything is unsynced). */
export async function clearLocalCache() {
  await localDb.sheets.clear();
}
