// Shared by server and client (no server-only imports).

import type { Role } from "./types";

export const COMMENT_MAX = 500;

/** A message in a count round, between staff and the supervisor. */
export interface CountComment {
  id: number;
  /** null = about the whole round; otherwise about that line */
  itemId: number | null;
  by: string;
  byRole: Role;
  mine: boolean;
  body: string;
  at: string; // ISO time
}

/** Sent from the count screen (queued offline in IndexedDB until online) or the review page. */
export interface CommentInput {
  clientId: string;
  itemId: number | null;
  body: string;
}
