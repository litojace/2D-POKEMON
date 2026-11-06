-- Storms water the crops too. A storm pours heavier rain than Rain, yet
-- only Rain counted as watering, so in a storm every growing crop showed
-- "dry". Now both do (a watered crop grows 35% faster); the Wet mutation
-- still comes only from Rain, and a storm keeps its 25% Shocked.
-- Run after 066_farm_more_pests.sql. Safe to run again.
begin;

-- As in 055_new_champion_farm_perks.sql, with storms counted as rain.
create or replace function public.arena_farm_sim(p public.arena_farm_plots, upto timestamptz,
  out g double precision, out wet boolean, out ripe_at timestamptz, out ripe_weather text)
language plpgsql stable set search_path = public as $$
declare at timestamptz; base double precision; s bigint; w text; seg_end timestamptz;
  rate double precision; need double precision; steps integer = 0;
begin
  if p.crop is null then g = 0; wet = false; return; end if;
  base = (case when p.fertilizer is not null then 1.4 else 1 end)
    * (1 - 0.2 * least(3, greatest(0, coalesce(p.pests, 0))))
    * (case when public.arena_farm_perk_of((select f.farmer from public.arena_farms f where f.player_id = p.player_id)) = 'lumoth'
        then 1.2 else 1 end)
    / (select grow_seconds from public.arena_farm_crops where id = p.crop)::double precision;
  g = p.progress; at = p.progress_at;
  wet = p.wet or exists (select 1 from generate_series(public.arena_farm_slot(p.planted_at),
    public.arena_farm_slot(p.progress_at)) x where public.arena_farm_weather(x) in ('rain', 'storm'));
  if g >= 1 then
    g = 1; ripe_at = p.progress_at; ripe_weather = public.arena_farm_weather(public.arena_farm_slot(at));
    return;
  end if;
  loop
    s = public.arena_farm_slot(at);
    w = public.arena_farm_weather(s);
    if w in ('rain', 'storm') then wet = true; end if;
    seg_end = to_timestamp((s + 1) * 14400);
    rate = base * (case when wet then 1.35 else 1 end) * public.arena_farm_weather_speed(w);
    need = (1 - g) / rate;
    if at + make_interval(secs => need) <= least(seg_end, upto) then
      g = 1; ripe_at = at + make_interval(secs => need); ripe_weather = w;
      return;
    end if;
    if seg_end >= upto then
      g = least(1, g + rate * greatest(0, extract(epoch from (upto - at))));
      return;
    end if;
    g = g + rate * extract(epoch from (seg_end - at));
    at = seg_end;
    steps = steps + 1;
    if steps > 1000 then return; end if;
  end loop;
end; $$;

commit;
