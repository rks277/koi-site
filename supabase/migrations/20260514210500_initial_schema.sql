create extension if not exists pgcrypto;

create table if not exists public.fish_genomes (
  id uuid primary key default gen_random_uuid(),
  genome jsonb not null,
  generation integer not null default 0,
  parent_a uuid references public.fish_genomes(id) on delete set null,
  parent_b uuid references public.fish_genomes(id) on delete set null,
  fitness double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.active_fish_slots (
  slot_index integer primary key,
  fish_id uuid references public.fish_genomes(id) on delete set null,
  activated_at timestamptz not null default now()
);

create table if not exists public.site_visitors (
  visitor_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.fish_genomes enable row level security;
alter table public.active_fish_slots enable row level security;
alter table public.site_visitors enable row level security;

drop policy if exists "Anyone can read fish genomes" on public.fish_genomes;
create policy "Anyone can read fish genomes"
on public.fish_genomes
for select
to anon
using (true);

drop policy if exists "Anyone can create fish genomes" on public.fish_genomes;
create policy "Anyone can create fish genomes"
on public.fish_genomes
for insert
to anon
with check (true);

drop policy if exists "Anyone can update fish fitness" on public.fish_genomes;
create policy "Anyone can update fish fitness"
on public.fish_genomes
for update
to anon
using (true)
with check (true);

drop policy if exists "Anyone can read active fish slots" on public.active_fish_slots;
create policy "Anyone can read active fish slots"
on public.active_fish_slots
for select
to anon
using (true);

drop policy if exists "Anyone can activate fish slots" on public.active_fish_slots;
create policy "Anyone can activate fish slots"
on public.active_fish_slots
for insert
to anon
with check (true);

drop policy if exists "Anyone can update active fish slots" on public.active_fish_slots;
create policy "Anyone can update active fish slots"
on public.active_fish_slots
for update
to anon
using (true)
with check (true);

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
