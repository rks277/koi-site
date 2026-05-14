grant select on public.site_visitors to anon, authenticated;

drop policy if exists "Anyone can read site visitors" on public.site_visitors;
create policy "Anyone can read site visitors"
on public.site_visitors
for select
to public
using (true);
