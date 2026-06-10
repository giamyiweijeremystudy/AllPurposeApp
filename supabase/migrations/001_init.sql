-- App config (one row per "workspace")
create table if not exists app_config (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My App',
  created_at timestamptz default now()
);

-- Sidebar sections
create table if not exists nav_sections (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references app_config(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Sidebar nav items (pages)
create table if not exists nav_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references nav_sections(id) on delete cascade,
  label text not null,
  icon text not null default 'ti-home',
  badge text default '',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Tabs (per page)
create table if not exists tabs (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references nav_items(id) on delete cascade,
  label text not null,
  icon text not null default 'ti-layout-dashboard',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Widgets (per page)
create table if not exists widgets (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references nav_items(id) on delete cascade,
  type text not null check (type in ('metric','note','list','progress','status')),
  label text not null,
  value text default '',
  sub text default '',
  note text default '',
  items jsonb default '[]',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Toolbar buttons
create table if not exists toolbar_buttons (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references app_config(id) on delete cascade,
  label text not null,
  icon text not null default 'ti-bolt',
  action text not null default 'none',
  prompt text default '',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table app_config enable row level security;
alter table nav_sections enable row level security;
alter table nav_items enable row level security;
alter table tabs enable row level security;
alter table widgets enable row level security;
alter table toolbar_buttons enable row level security;

-- Allow all operations for anonymous users (public app, no auth yet)
create policy "public_all" on app_config for all using (true) with check (true);
create policy "public_all" on nav_sections for all using (true) with check (true);
create policy "public_all" on nav_items for all using (true) with check (true);
create policy "public_all" on tabs for all using (true) with check (true);
create policy "public_all" on widgets for all using (true) with check (true);
create policy "public_all" on toolbar_buttons for all using (true) with check (true);

-- Seed default data
with app as (
  insert into app_config (name) values ('My App') returning id
),
sec_main as (
  insert into nav_sections (app_id, label, sort_order)
  select id, 'Main', 0 from app returning id
),
sec_work as (
  insert into nav_sections (app_id, label, sort_order)
  select id, 'Work', 1 from app returning id
),
page_overview as (
  insert into nav_items (section_id, label, icon, sort_order)
  select id, 'Overview', 'ti-home', 0 from sec_main returning id
),
page_analytics as (
  insert into nav_items (section_id, label, icon, sort_order)
  select id, 'Analytics', 'ti-chart-bar', 1 from sec_main returning id
),
page_tasks as (
  insert into nav_items (section_id, label, icon, badge, sort_order)
  select id, 'Tasks', 'ti-list', '3', 0 from sec_work returning id
),
page_files as (
  insert into nav_items (section_id, label, icon, sort_order)
  select id, 'Files', 'ti-folder', 1 from sec_work returning id
),
_tabs as (
  insert into tabs (page_id, label, icon, sort_order)
  select id, 'Dashboard', 'ti-layout-dashboard', 0 from page_overview
  union all
  select id, 'Stats', 'ti-chart-bar', 0 from page_analytics
  union all
  select id, 'To-do', 'ti-list', 0 from page_tasks
  union all
  select id, 'Done', 'ti-check', 1 from page_tasks
  union all
  select id, 'Docs', 'ti-file', 0 from page_files
),
_widgets as (
  insert into widgets (page_id, type, label, value, sub, sort_order)
  select id, 'metric', 'Total Users', '1,284', '↑ 12% this week', 0 from page_overview
  union all
  select id, 'metric', 'Revenue', '$8,420', '↑ 5% vs last month', 1 from page_overview
  union all
  select id, 'metric', 'Page Views', '42,100', 'Last 30 days', 0 from page_analytics
  union all
  select id, 'metric', 'Bounce Rate', '34%', '↓ 2% improvement', 1 from page_analytics
  union all
  select id, 'metric', 'Total Files', '128', 'Across all folders', 0 from page_files
)
insert into widgets (page_id, type, label, note, sort_order)
select id, 'note', 'Quick Note', 'Welcome! This app is backed by Supabase + deployed on Vercel. All changes persist in real-time.', 2 from page_overview;
