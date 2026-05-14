create or replace function public.prune_fish_genomes(max_history integer default 500)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fish_genomes
  where id not in (
    select fish_id
    from public.active_fish_slots
    where fish_id is not null
  )
  and id not in (
    select id
    from public.fish_genomes
    order by created_at desc, id desc
    limit greatest(max_history, 0)
  );
$$;

create or replace function public.prune_fish_genomes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.prune_fish_genomes(500);
  return new;
end;
$$;

drop trigger if exists prune_fish_genomes_after_insert on public.fish_genomes;
create trigger prune_fish_genomes_after_insert
after insert on public.fish_genomes
for each statement
execute function public.prune_fish_genomes_after_insert();

select public.prune_fish_genomes(500);
