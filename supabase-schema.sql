create table if not exists public.site_visitors (
  visitor_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.site_visitors enable row level security;

drop policy if exists "Anyone can record site visitors" on public.site_visitors;
create policy "Anyone can record site visitors"
on public.site_visitors
for insert
to anon
with check (true);

drop policy if exists "Anyone can update site visitor last_seen_at" on public.site_visitors;
create policy "Anyone can update site visitor last_seen_at"
on public.site_visitors
for update
to anon
using (true)
with check (true);

-- Unique visitor count:
-- select count(*) from public.site_visitors;
