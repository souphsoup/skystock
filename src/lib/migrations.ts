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
  {
    id: "005_proposals",
    sql: `
-- พนักงานเสนอรายการที่ยังไม่มีในใบนับ หัวหน้าอนุมัติแล้วจึงกลายเป็นรายการจริง (items)
create table item_proposals (
  id serial primary key,
  outlet_id int not null references outlets(id),
  client_id uuid unique, -- idempotency key from the device's offline queue
  location_id int not null references locations(id),
  name_th text not null,
  name_en text not null default '',
  unit text not null,
  counted numeric(12,2) check (counted >= 0), -- what the proposer found on the shelf, if counted
  note text,
  business_date date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by int not null references users(id),
  created_at timestamptz not null default now(),
  decided_by int references users(id),
  decided_at timestamptz,
  reject_reason text,
  item_id int references items(id)
);
create index item_proposals_pending_idx on item_proposals (outlet_id) where status = 'pending';
alter table item_proposals enable row level security;
`,
  },
  {
    id: "006_lockdown",
    sql: `
-- Supabase: the public API roles get table privileges by default. RLS without policies
-- already hides every row, but TRUNCATE ignores RLS, so take the privileges away too.
-- Only this app's server (postgres role through the pooler) touches the data.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke all on all functions in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
  end if;
end $$;
`,
  },
  {
    id: "007_usage",
    sql: `
-- ติดตามการใช้งานแอป (หน้า /usage): เข้าใช้ล่าสุดต่อผู้ใช้ และประวัติการเข้าสู่ระบบ ทั้งสำเร็จและไม่สำเร็จ
alter table users add column last_seen_at timestamptz;
create table login_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id int references users(id), -- null = ชื่อผู้ใช้ที่ไม่มีในระบบ
  login text not null,
  ok boolean not null,
  reason text check (reason in ('bad_pin','locked','unknown')),
  user_agent text
);
create index login_events_at_idx on login_events (at desc);
create index login_events_user_idx on login_events (user_id, at desc);
alter table login_events enable row level security;
`,
  },
  {
    id: "008_signup",
    sql: `
-- สมัครใช้งานเองจากหน้า /signup: บัญชีเริ่มที่ approval = 'pending' + active = false จนกว่า Admin จะอนุมัติ
-- null = บัญชีปกติ (Admin สร้างเอง หรืออนุมัติแล้ว), 'rejected' = Admin ปฏิเสธ (สมัครชื่อเดิมใหม่ได้)
alter table users add column approval text check (approval in ('pending','rejected'));
create index users_pending_idx on users (outlet_id) where approval = 'pending';
alter table login_events drop constraint if exists login_events_reason_check;
alter table login_events add constraint login_events_reason_check check (reason in ('bad_pin','locked','unknown','pending'));
`,
  },
  {
    id: "009_count_comments",
    sql: `
-- ข้อความในรอบนับ ระหว่างพนักงานกับหัวหน้า: item_id = null คือข้อความถึงทั้งรอบ, มีค่า = คุยเรื่องรายการนั้น
-- เพิ่มได้อย่างเดียว ไม่มีแก้หรือลบ (เป็นหลักฐานคู่กับ audit_log)
create table count_comments (
  id serial primary key,
  count_id int not null references counts(id) on delete cascade,
  item_id int references items(id),
  client_id uuid unique, -- idempotency key from the device's offline queue
  body text not null check (length(body) between 1 and 500),
  created_by int not null references users(id),
  created_at timestamptz not null default now()
);
create index count_comments_count_idx on count_comments (count_id, created_at);
alter table count_comments enable row level security;
`,
  },
  {
    id: "010_login_throttle",
    sql: `
-- จำกัดการใส่ PIN ผิดต่อ IP (กันเดา PIN และกันคนนอกไล่ล็อกบัญชีคนอื่น) นับเป็นช่วงเวลา แถวเก่าลบทิ้งได้
create table login_throttle (
  ip text primary key,
  window_start timestamptz not null default now(),
  failures int not null default 0
);
alter table login_throttle enable row level security;
alter table login_events drop constraint if exists login_events_reason_check;
alter table login_events add constraint login_events_reason_check
  check (reason in ('bad_pin','locked','unknown','pending','throttled'));
`,
  },
  {
    id: "011_history_indexes",
    sql: `
-- ยอดนับล่าสุดของแต่ละรายการ (ยกมา, แจ้งเตือนต่ำกว่า Par) หาได้จาก index ทีละรายการ
-- แทนการอ่านประวัติการนับทั้งหมด: เก็บวันที่ของรอบนับไว้ที่บรรทัดด้วย (วันที่ของรอบนับไม่เปลี่ยน)
alter table count_lines add column business_date date;
-- เติมเองถ้าโค้ดที่ insert ไม่ได้ใส่มา: แอปรุ่นก่อนหน้ายังทำงานได้ถ้า migration นี้ขึ้นก่อน deploy
create function count_lines_business_date() returns trigger language plpgsql set search_path = public as $$
begin
  if new.business_date is null then
    select c.business_date into new.business_date from counts c where c.id = new.count_id;
  end if;
  return new;
end $$;
create trigger count_lines_business_date before insert on count_lines
  for each row execute function count_lines_business_date();
update count_lines l set business_date = c.business_date from counts c where c.id = l.count_id;
alter table count_lines alter column business_date set not null;
create index count_lines_item_date_idx on count_lines (item_id, business_date desc) where counted is not null;
-- หน้าการใช้งานแอป และหน้าประวัติการแก้ไข
create index movement_lines_movement_idx on movement_lines (movement_id);
create index count_lines_counted_by_idx on count_lines (counted_by, updated_at);
create index audit_log_user_idx on audit_log (user_id, at);
create index audit_log_at_idx on audit_log (at desc);
`,
  },
  {
    id: "012_user_profile",
    sql: `
-- ข้อมูลส่วนตัวที่ผู้ใช้กรอกเองในหน้า "ฉัน" (เห็นเฉพาะเจ้าของบัญชีและ Admin) ทุกช่องไม่บังคับ
-- avatar_key = path ใน storage (outlet-{id}/avatars/...) เปลี่ยนชื่อไฟล์ทุกครั้งที่อัปโหลด
alter table users
  add column avatar_key text,
  add column full_name text,
  add column nickname text,
  add column phone text,
  add column email text,
  add column line_id text,
  add column birthday date,
  add column allergies text,
  add column emergency_name text,
  add column emergency_phone text;
`,
  },
];
