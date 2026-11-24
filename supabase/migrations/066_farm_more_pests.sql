-- More bugs and crows, to match the faster crops (062): crops now spend
-- far less time growing, so bugs had little time to find them. A growing
-- plot now gets a bug at twice the old rate (0.0001 a second while you are
-- on the farm) and a crow comes about every 56 minutes on the farm (was 84).
-- Scarecrow, guard dogs and Warmth work as before.
-- Run after 065_farm_decor_storage.sql. Safe to run again.
begin;

-- As in 046_farm_perks.sql, with the higher rates.
create or replace function public.arena_farm_bugs(pid uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; t timestamptz = now(); secs double precision; chance double precision;
  p public.arena_farm_plots; n integer = 0; v_dog text; v_crow integer;
begin
  if current_setting('arena.farm_bugs', true) = 'off' then return 0; end if;
  select * into f from public.arena_farms where player_id = pid for update;
  if f.player_id is null then return 0; end if;
  update public.arena_farms set seen_at = t where player_id = pid;
  secs = extract(epoch from (t - f.seen_at));
  if secs is null or secs <= 0 or secs > 150 then return 0; end if;
  v_dog = public.arena_farm_dog(pid, t);
  chance = case when f.warm_until > t then 0 else 1 - exp(-0.0001 * (case when f.scarecrow then 0.5 else 1 end)
    * (case when v_dog = 'black' then 0.7 else 1 end) * secs) end;
  if chance > 0 then
    for p in select * from public.arena_farm_plots
        where player_id = pid and owned and crop is not null and pests < 2 order by idx loop
      if random() < chance and public.arena_farm_growth(p, t) < 1 then
        perform public.arena_farm_set_pests(pid, p.idx, p.pests + 1, t);
        n = n + 1;
      end if;
    end loop;
  end if;
  -- A crow: about one every 56 minutes on the farm, on a ripe crop.
  if not f.scarecrow and v_dog is null and random() < 1 - exp(-secs / 3360.0) then
    select x.idx into v_crow from public.arena_farm_plots x
     where x.player_id = pid and x.owned and x.crop is not null and x.crow_at is null
       and public.arena_farm_growth(x, t) >= 1
     order by random() limit 1;
    if v_crow is not null then
      update public.arena_farm_plots set crow_at = t where player_id = pid and idx = v_crow;
    end if;
  end if;
  return n;
end; $$;

commit;
