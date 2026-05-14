grant select, insert, update on public.fish_genomes to anon, authenticated;
grant select, insert, update on public.active_fish_slots to anon, authenticated;
grant insert, update on public.site_visitors to anon, authenticated;

drop policy if exists "Anyone can read fish genomes" on public.fish_genomes;
create policy "Anyone can read fish genomes"
on public.fish_genomes
for select
to public
using (true);

drop policy if exists "Anyone can create fish genomes" on public.fish_genomes;
create policy "Anyone can create fish genomes"
on public.fish_genomes
for insert
to public
with check (true);

drop policy if exists "Anyone can update fish fitness" on public.fish_genomes;
create policy "Anyone can update fish fitness"
on public.fish_genomes
for update
to public
using (true)
with check (true);

drop policy if exists "Anyone can read active fish slots" on public.active_fish_slots;
create policy "Anyone can read active fish slots"
on public.active_fish_slots
for select
to public
using (true);

drop policy if exists "Anyone can activate fish slots" on public.active_fish_slots;
create policy "Anyone can activate fish slots"
on public.active_fish_slots
for insert
to public
with check (true);

drop policy if exists "Anyone can update active fish slots" on public.active_fish_slots;
create policy "Anyone can update active fish slots"
on public.active_fish_slots
for update
to public
using (true)
with check (true);

drop policy if exists "Anyone can record site visitors" on public.site_visitors;
create policy "Anyone can record site visitors"
on public.site_visitors
for insert
to public
with check (true);

drop policy if exists "Anyone can update site visitor last_seen_at" on public.site_visitors;
create policy "Anyone can update site visitor last_seen_at"
on public.site_visitors
for update
to public
using (true)
with check (true);
