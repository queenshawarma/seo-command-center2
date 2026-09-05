-- ============================================
-- SEO Command Center — Database Schema (Step 1)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1) المواقع
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,               -- example.com
  gsc_property text,                  -- sc-domain:example.com or https://example.com/
  ga4_property_id text,               -- 123456789
  client_name text,                   -- اختياري لو شغل عملاء
  status text default 'active',       -- active / paused
  monthly_goal text,                  -- هدف الشهر بشكل نصي مبدئياً
  created_at timestamptz default now()
);

-- 2) المهام (To-Do)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  title text not null,
  description text,
  category text,                      -- technical / content / links / other
  priority text default 'medium',     -- high / medium / low
  effort_minutes int default 30,
  due_date date,
  status text default 'todo',         -- todo / doing / done
  impact_score numeric default 0,     -- محسوبة لاحقاً من الفرص
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 3) بيانات الأداء اليومية (من GSC/GA4)
create table if not exists metrics_daily (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  date date not null,
  source text not null,               -- 'gsc' or 'ga4'
  clicks int default 0,
  impressions int default 0,
  ctr numeric default 0,
  avg_position numeric default 0,
  sessions int default 0,
  users int default 0,
  conversions int default 0,
  raw jsonb,                          -- تخزين تفاصيل إضافية (top queries/pages) لو احتجنا
  unique(site_id, date, source)
);

-- 4) التنبيهات (تراجعات وأخطاء)
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  type text not null,                 -- traffic_drop / indexing / ctr_drop / technical
  severity text default 'medium',     -- high / medium / low
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 5) الفرص المكتشفة (Quick Wins, CTR Opportunity, ...)
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  type text not null,                 -- quick_win / ctr / content_refresh / cannibalization
  page_url text,
  query text,
  details jsonb,
  priority_score numeric default 0,
  status text default 'new',          -- new / converted_to_task / dismissed
  created_at timestamptz default now()
);

create index if not exists idx_metrics_site_date on metrics_daily(site_id, date);
create index if not exists idx_tasks_site_status on tasks(site_id, status);
create index if not exists idx_alerts_site_read on alerts(site_id, is_read);
