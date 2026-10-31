// Shared by server and client (no server-only imports).

export type ProposalStatus = "pending" | "approved" | "rejected";

/** Sent from the count screen (queued offline in IndexedDB until online). */
export interface ProposalInput {
  clientId: string;
  locationId: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  counted: number | null;
  note: string;
  recordedAt: number; // ms, when staff pressed send (may be long before it syncs)
}

/** Shown under the count sheet so staff see what they proposed and what happened to it. */
export interface SheetProposal {
  id: number;
  nameTh: string;
  nameEn: string;
  unit: string;
  counted: number | null;
  status: ProposalStatus;
  rejectReason: string | null;
  by: string;
}
