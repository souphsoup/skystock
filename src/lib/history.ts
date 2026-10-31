import "server-only";
import { getDb } from "./db";
import type { User } from "./session";
import type { Role } from "./types";
import { tk } from "@/i18n";
import { AREAS, type HistoryArea } from "./history-types";

export interface HistoryChange {
  field: string; // Thai key (tk)
  from: unknown;
  to: unknown;
  kind: "qty" | "baht" | "bool" | "role" | "text";
}

export interface HistoryEntry {
  id: number;
  at: Date;
  who: string;
  whoRole: Role;
  action: string;
  /** what was touched, e.g. an item name or "Freezer · 2026-10-30" */
  subject: string | null;
  /** extra context, e.g. "Freezer" for an item line or the movement kind */
  detail: Record<string, unknown>;
  changes: HistoryChange[];
  note: string | null;
}

const ITEM_FIELDS: { key: string; field: string; kind: HistoryChange["kind"] }[] = [
  { key: "nameTh", field: tk("ชื่อ (ไทย)"), kind: "text" },
  { key: "nameEn", field: tk("ชื่อ (English)"), kind: "text" },
  { key: "unit", field: tk("หน่วย"), kind: "text" },
  { key: "unitCost", field: tk("ราคาทุน"), kind: "baht" },
  { key: "par", field: tk("Par"), kind: "qty" },
  { key: "blind", field: tk("นับแบบไม่เห็นยอด"), kind: "bool" },
  { key: "active", field: tk("ใช้งาน"), kind: "bool" },
  { key: "categoryId", field: tk("หมวด"), kind: "text" },
  { key: "locationId", field: tk("จุดเก็บ"), kind: "text" },
];

const LINE_FIELDS: { key: string; field: string }[] = [
  { key: "counted", field: tk("คงเหลือ") },
  { key: "in", field: tk("รับเข้า") },
  { key: "out", field: tk("เบิกออก") },
];

type Obj = Record<string, unknown> | null;
// numeric columns may come back as "12.00" on one side and 12 on the other
function same(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  return typeof a === typeof b ? a === b : Number(a) === Number(b);
}

function changesOf(action: string, before: Obj, after: Obj, names: { loc: Map<number, string>; cat: Map<number, string> }): HistoryChange[] {
  const b = before ?? {};
  const a = after ?? {};
  const diff = (key: string, field: string, kind: HistoryChange["kind"]) =>
    same(b[key], a[key]) ? [] : [{ field, from: b[key] ?? null, to: a[key] ?? null, kind }];

  if (action === "item.update") {
    return ITEM_FIELDS.flatMap(({ key, field, kind }) => {
      if (same(b[key], a[key])) return [];
      const map = key === "categoryId" ? names.cat : key === "locationId" ? names.loc : null;
      const name = (v: unknown) => (map && v != null ? (map.get(Number(v)) ?? `#${v}`) : (v ?? null));
      return [{ field, from: name(b[key]), to: name(a[key]), kind }];
    });
  }
  if (action === "line.recount_edit" || action === "line.adjust") {
    return LINE_FIELDS.flatMap(({ key, field }) => (key in a ? diff(key, field, "qty") : []));
  }
  if (action === "user.update") return [...diff("name", tk("ชื่อ"), "text"), ...diff("role", tk("สิทธิ์"), "role")];
  if (action === "category.rename") return diff("name", tk("ชื่อ"), "text");
  if (action === "notify.lang") return diff("lang", tk("ภาษา"), "text");
  return [];
}

/** audit_log of this outlet, newest first, with the touched record resolved to a readable name. */
export async function listHistory(
  user: User,
  opts: { days: number; userId?: number | null; area?: HistoryArea },
): Promise<HistoryEntry[]> {
  const db = await getDb();
  const prefixes = opts.area && opts.area !== "all" ? AREAS[opts.area].prefixes : null;
  const [rows, locs, cats] = await Promise.all([
    db.query<{
      id: number;
      at: Date;
      action: string;
      entity: string;
      before: Obj | string;
      after: Obj | string;
      note: string | null;
      who: string;
      who_role: Role;
      count_loc: string | null;
      count_date: string | null;
      item_name: string | null;
      line_item_name: string | null;
      move_kind: string | null;
      move_loc: string | null;
      move_to: string | null;
      move_items: string | null;
      user_name: string | null;
      proposal_name: string | null;
      target_label: string | null;
    }>(
      `with a as (
         select a.*, nullif(split_part(a.entity_id, ':', 1), '')::int as id1,
                nullif(split_part(a.entity_id, ':', 2), '')::int as id2
         from audit_log a
         join users u on u.id = a.user_id
         where u.outlet_id = $1 and a.at >= now() - make_interval(days => $2)
           and ($3::int is null or a.user_id = $3)
           and ($4::text[] is null or split_part(a.action, '.', 1) = any($4))
         order by a.at desc, a.id desc
         limit 300
       )
       select a.id, a.at, a.action, a.entity, a.before, a.after, a.note,
              u.name as who, u.role as who_role,
              cl.name as count_loc, to_char(c.business_date, 'YYYY-MM-DD') as count_date,
              coalesce(nullif(i.name_en, ''), i.name_th) as item_name,
              coalesce(nullif(li.name_en, ''), li.name_th) as line_item_name,
              m.kind as move_kind, ml.name as move_loc, mt.name as move_to,
              (select string_agg(coalesce(nullif(mi.name_en, ''), mi.name_th) || ' ' || trim_scale(l.qty)::text || ' ' || mi.unit,
                                 ', ' order by l.id)
               from movement_lines l join items mi on mi.id = l.item_id
               where l.movement_id = m.id and l.direction = case when m.kind = 'receive' then 'in' else 'out' end
              ) as move_items,
              tu.name as user_name,
              coalesce(nullif(p.name_en, ''), p.name_th) as proposal_name,
              coalesce(nullif(nt.label, ''), nt.address) as target_label
       from a
       join users u on u.id = a.user_id
       left join counts c on a.entity in ('count', 'count_line') and c.id = a.id1
       left join locations cl on cl.id = c.location_id
       left join items i on a.entity = 'item' and i.id = a.id1
       left join items li on a.entity = 'count_line' and li.id = a.id2
       left join movements m on a.entity = 'movement' and m.id = a.id1
       left join locations ml on ml.id = coalesce(m.from_location_id, m.to_location_id)
       left join locations mt on m.kind = 'transfer' and mt.id = m.to_location_id
       left join users tu on a.entity = 'user' and tu.id = a.id1
       left join item_proposals p on a.entity = 'item_proposal' and p.id = a.id1
       left join notify_targets nt on a.entity = 'notify_target' and nt.id = a.id1
       order by a.at desc, a.id desc`,
      [user.outletId, opts.days, opts.userId ?? null, prefixes],
    ),
    db.query<{ id: number; name: string }>(`select id, name from locations where outlet_id = $1`, [user.outletId]),
    db.query<{ id: number; name: string }>(`select id, name from categories where outlet_id = $1`, [user.outletId]),
  ]);
  const names = { loc: new Map(locs.map((l) => [l.id, l.name])), cat: new Map(cats.map((c) => [c.id, c.name])) };
  const json = (v: Obj | string): Obj => (typeof v === "string" ? JSON.parse(v) : v);

  return rows.map((r) => {
    const before = json(r.before);
    const after = json(r.after);
    const snap = after ?? before ?? {};
    const detail: Record<string, unknown> = {};
    let subject: string | null = null;
    switch (r.entity) {
      case "count":
        subject = r.count_loc;
        detail.date = r.count_date;
        if (typeof after?.flagged === "number") detail.flagged = after.flagged;
        if (typeof after?.lines === "number") detail.lines = after.lines;
        break;
      case "count_line":
        subject = r.line_item_name;
        detail.location = r.count_loc;
        detail.date = r.count_date;
        break;
      case "item":
        subject = r.item_name ?? (snap.nameEn as string) ?? (snap.nameTh as string) ?? null;
        break;
      case "movement":
        detail.kind = r.move_kind ?? snap.kind ?? null;
        subject = r.move_to ? `${r.move_loc} → ${r.move_to}` : r.move_loc;
        detail.items = r.move_items;
        break;
      case "user":
        subject = r.user_name;
        break;
      case "category":
        subject = (after?.name ?? before?.name ?? null) as string | null;
        break;
      case "item_proposal":
        subject = r.proposal_name ?? (snap.nameEn as string) ?? (snap.nameTh as string) ?? null;
        break;
      case "notify_target":
        subject = r.target_label ?? (snap.label as string) ?? (snap.address as string) ?? null;
        break;
    }
    return {
      id: Number(r.id),
      at: r.at,
      who: r.who,
      whoRole: r.who_role,
      action: r.action,
      subject,
      detail,
      changes: changesOf(r.action, before, after, names),
      note: r.note ?? (typeof after?.reason === "string" && r.entity === "item_proposal" ? after.reason : null),
    };
  });
}

/** Users of this outlet who appear as the author filter. */
export async function historyUsers(user: User) {
  const db = await getDb();
  return db.query<{ id: number; name: string }>(
    `select id, name from users where outlet_id = $1 order by active desc, name`,
    [user.outletId],
  );
}
