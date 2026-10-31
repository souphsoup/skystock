// Schema migrations, applied in order on first DB access (see db.ts).
// Kept as TS strings so they ship with the server bundle on Vercel.
// The same SQL can be pasted into the Supabase SQL editor.

export const migrations: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: /* sql */ `
create table outlets (
  id serial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- จุดเก็บ: Freezer, Chiller, คลังแห้ง, บาร์ชั้น 22, บาร์ชั้น 24
create table locations (
  id serial primary key,
  outlet_id int not null references outlets(id),
  code text not null,
  name text not null,
  due_time time not null default '16:30',
  sort_order int not null default 0,
  active boolean not null default true,
  unique (outlet_id, code)
);

-- หมวด › ชนิด › ส่วน (ซ้อนกันผ่าน parent_id สูงสุด 3 ชั้น)
create table categories (
  id serial primary key,
  outlet_id int not null references outlets(id),
  parent_id int references categories(id),
  name text not null,
  level smallint not null check (level between 1 and 3),
  sort_order int not null default 0
);

create table items (
  id serial primary key,
  outlet_id int not null references outlets(id),
  category_id int references categories(id),
  location_id int not null references locations(id),
  name_th text not null,
  name_en text not null default '',
  unit text not null,
  unit_cost numeric(12,2) not null default 0,
  par numeric(12,2) not null default 0,
  blind boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index items_location_idx on items (location_id, sort_order);

create table users (
  id serial primary key,
  outlet_id int not null references outlets(id),
  login text not null unique,
  name text not null,
  role text not null check (role in ('operation','supervisor','manager','admin')),
  pin_hash text not null,
  active boolean not null default true,
  session_version int not null default 0,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- รอบนับ: 1 รอบต่อจุดเก็บต่อวันทำการ
create table counts (
  id serial primary key,
  location_id int not null references locations(id),
  business_date date not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','recount','approved')),
  submitted_by int references users(id),
  submitted_at timestamptz,
  approved_by int references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (location_id, business_date)
);

-- opening = ยกมา (null = ยังไม่มียอดยกมา นับครั้งแรกเป็นยอดตั้งต้น)
-- expected = ยกมา + รับเข้า − เบิกออก, counted = ยอดที่นับได้จริง (total)
create table count_lines (
  count_id int not null references counts(id) on delete cascade,
  item_id int not null references items(id),
  opening numeric(12,2),
  in_qty numeric(12,2) not null default 0 check (in_qty >= 0),
  out_qty numeric(12,2) not null default 0 check (out_qty >= 0),
  expected numeric(12,2) generated always as (opening + in_qty - out_qty) stored,
  counted numeric(12,2) check (counted >= 0),
  status text not null default 'pending'
    check (status in ('pending','ok','flag','recount','confirmed')),
  counted_by int references users(id),
  updated_at timestamptz not null default now(),
  primary key (count_id, item_id)
);
create index count_lines_item_idx on count_lines (item_id);

-- Audit log: ใคร เวลาไหน ค่าเดิม ค่าใหม่ — แก้หรือลบไม่ได้
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id int references users(id),
  action text not null,
  entity text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  note text
);

create function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- ฐานข้อมูลเข้าได้จาก server ของแอปเท่านั้น: เปิด RLS โดยไม่มี policy
-- ทำให้ anon/authenticated key ของ Supabase อ่านเขียนตารางเหล่านี้ไม่ได้
alter table outlets enable row level security;
alter table locations enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table users enable row level security;
alter table counts enable row level security;
alter table count_lines enable row level security;
alter table audit_log enable row level security;
`,
  },
  {
    id: "002_movements",
    sql: /* sql */ `
-- รับของ / เบิกเข้าครัว / โอนระหว่างจุด / ของเสีย
create table movements (
  id serial primary key,
  outlet_id int not null references outlets(id),
  kind text not null check (kind in ('receive','issue','transfer','waste')),
  client_id uuid unique, -- idempotency key from the device's offline queue
  supplier text,
  reason text,
  note text,
  photo_key text,
  from_location_id int references locations(id),
  to_location_id int references locations(id),
  recorded_at timestamptz not null,
  created_by int not null references users(id),
  created_at timestamptz not null default now(),
  voided_by int references users(id),
  voided_at timestamptz,
  void_reason text
);
create index movements_outlet_idx on movements (outlet_id, recorded_at desc);

-- One row per item effect. count_id = the count round this movement feeds
-- (null until the next count for the item's location is opened).
create table movement_lines (
  id serial primary key,
  movement_id int not null references movements(id) on delete cascade,
  item_id int not null references items(id),
  direction text not null check (direction in ('in','out')),
  qty numeric(12,2) not null check (qty > 0),
  count_id int references counts(id)
);
create index movement_lines_pending_idx on movement_lines (item_id) where count_id is null;
create index movement_lines_count_idx on movement_lines (count_id, item_id);

-- in/out ของใบนับ = ที่บันทึกผ่านรับ/เบิก/โอน/ของเสีย (mv_*, server ดูแล) + ที่พนักงานกรอกเพิ่มเอง (in_qty/out_qty)
alter table count_lines add column mv_in numeric(12,2) not null default 0;
alter table count_lines add column mv_out numeric(12,2) not null default 0;
alter table count_lines drop column expected;
alter table count_lines add column expected numeric(12,2)
  generated always as (opening + mv_in + in_qty - mv_out - out_qty) stored;

alter table movements enable row level security;
alter table movement_lines enable row level security;
`,
  },
  {
    id: "003_notify",
    sql: `
-- ผู้รับสรุปตอนเช้า: กลุ่ม/ผู้ใช้ LINE OA (ลงทะเบียนเองตอนเพิ่มบอท) หรืออีเมล
-- เริ่มต้นปิดไว้ (active = false) จนกว่า Admin จะเปิด กันคนนอกเพิ่มบอทเข้ากลุ่มแล้วได้ข้อมูลสต๊อก
create table notify_targets (
  id serial primary key,
  outlet_id int not null references outlets(id),
  channel text not null check (channel in ('line','email')),
  address text not null,
  label text not null default '',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (outlet_id, channel, address)
);

-- ประวัติการส่ง: kind = morning (ตามเวลา, ส่งครั้งเดียวต่อวัน) | test (กดส่งทดสอบ)
create table notify_runs (
  id serial primary key,
  outlet_id int not null references outlets(id),
  kind text not null check (kind in ('morning','test')),
  business_date date not null,
  status text not null check (status in ('sending','sent','partial','failed','dry_run','no_targets')),
  results jsonb,
  created_by int references users(id),
  created_at timestamptz not null default now()
);
create unique index notify_runs_morning_once on notify_runs (outlet_id, business_date) where kind = 'morning';

alter table notify_targets enable row level security;
alter table notify_runs enable row level security;
`,
  },
  {
    id: "004_lang",
    sql: `
-- ภาษาหน้าจอต่อผู้ใช้ และภาษาของสรุปตอนเช้าต่อผู้รับ
alter table users add column lang text not null default 'th' check (lang in ('th','en'));
alter table notify_targets add column lang text not null default 'th' check (lang in ('th','en'));
`,
  },
];
