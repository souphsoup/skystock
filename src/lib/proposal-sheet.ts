import "server-only";
import type { Db } from "./db";
import type { ProposalStatus, SheetProposal } from "./proposal-types";

/** Proposals for one location: still pending, or decided on this business date. */
export async function sheetProposals(db: Db, locationId: number, date: string): Promise<SheetProposal[]> {
  const rows = await db.query<{
    id: number;
    name_th: string;
    name_en: string;
    unit: string;
    counted: number | null;
    status: ProposalStatus;
    reject_reason: string | null;
    by_name: string;
  }>(
    `select p.id, p.name_th, p.name_en, p.unit, p.counted, p.status, p.reject_reason, u.name as by_name
     from item_proposals p join users u on u.id = p.created_by
     where p.location_id = $1 and (p.status = 'pending' or p.business_date = $2
       or ((p.decided_at at time zone 'Asia/Bangkok') - interval '6 hours')::date = $2)
     order by p.created_at`,
    [locationId, date],
  );
  return rows.map((r) => ({
    id: r.id,
    nameTh: r.name_th,
    nameEn: r.name_en,
    unit: r.unit,
    counted: r.counted,
    status: r.status,
    rejectReason: r.reject_reason,
    by: r.by_name,
  }));
}
