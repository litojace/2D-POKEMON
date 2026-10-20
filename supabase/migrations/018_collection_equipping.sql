-- Restore collection appearance support after older raid functions were reapplied.
-- Run after 017_admin_mythic_testing.sql. Safe to run again.
-- Only slot mappings and appearance functions change; purchases, wallets,
-- earned rewards and administrator testing privileges are preserved.
begin;

-- Canonical mappings for the thirty Shop collection pieces.
with collections(id) as (values ('candy'), ('galaxy'), ('retro'), ('festival'), ('garden'), ('winter')),
slots(suffix, slot) as (values ('colours', 'skin'), ('aura', 'aura'), ('entrance', 'entrance'), ('frame', 'frame'), ('victory', 'victory'))
update public.arena_shop_items i set slot = s.slot
from collections c cross join slots s
where i.id = c.id || '-' || s.suffix and i.kind = 'look';

create or replace function public.arena_raid_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid();
  today date = (now() at time zone 'America/Los_Angeles')::date;
  week_start date;
  earned text[];
  loadout public.arena_raid_loadouts;
  bosses jsonb; stats jsonb; crag jsonb;
begin
  if me is null then raise exception 'Login required'; end if;
  week_start = today - extract(dow from today)::int;
  earned = array(select public.arena_raid_earned(me));
  select coalesce(jsonb_object_agg(boss, jsonb_build_object(
           'clears', clears, 'highestPeril', highest, 'bestSeconds', best, 'runs', runs)), '{}'::jsonb),
         coalesce(jsonb_object_agg(boss, jsonb_build_object(
           'pillars', pillars, 'revives', revives, 'feats', feats)), '{}'::jsonb)
    into bosses, stats
    from (select r.boss,
                 count(*) filter (where r.result = 'victory') as clears,
                 coalesce(max(r.peril) filter (where r.result = 'victory'), 0) as highest,
                 min(r.seconds) filter (where r.result = 'victory') as best,
                 count(*) as runs,
                 coalesce(sum(p.pillars), 0) as pillars,
                 coalesce(sum(p.revives), 0) as revives,
                 count(*) filter (where r.result = 'victory' and r.feat) as feats
            from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
           where p.player_id = me
           group by r.boss) b;
  crag = coalesce(bosses->'grumblecrag',
    '{"clears":0,"highestPeril":0,"bestSeconds":null,"runs":0}'::jsonb);
  select * into loadout from public.arena_raid_loadouts where player_id = me;
  return jsonb_build_object(
    -- Grumblecrag's numbers at the top level, for clients older than the Hub.
    'clears', (crag->>'clears')::int,
    'highestPeril', (crag->>'highestPeril')::int,
    'bestSeconds', crag->'bestSeconds',
    'runs', (crag->>'runs')::int,
    'pillars', coalesce((stats->'grumblecrag'->>'pillars')::int, 0),
    'revives', coalesce((stats->'grumblecrag'->>'revives')::int, 0),
    'bosses', bosses,
    'stats', stats,
    'totalClears', (select count(*) from public.arena_raid_runs r
                      join public.arena_raid_players p on p.run_id = r.id
                     where p.player_id = me and r.result = 'victory'),
    'earned', to_jsonb(earned),
    'cosmetics', coalesce((select jsonb_agg(w.id order by w.id) from public.arena_raid_rewards w
                            where w.slot <> 'title' and w.id = any(earned)), '[]'::jsonb),
    'equipped', coalesce(loadout.skin, loadout.aura, loadout.cosmetic),
    'loadout', jsonb_build_object('skin', loadout.skin, 'aura', loadout.aura,
                                  'entrance', loadout.entrance, 'frame', loadout.frame,
                                  'victory', loadout.victory),
    'titles', coalesce((select jsonb_agg(t.name order by t.name)
                          from public.arena_player_titles g join public.arena_titles t on t.id = g.title_id
                         where g.player_id = me
                           and t.name in (select w.name from public.arena_raid_rewards w where w.slot = 'title')),
                       '[]'::jsonb),
    'weekly', '[]'::jsonb,
    'today', jsonb_build_object(
      'day', today,
      'cleared', exists (select 1 from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
                          where p.player_id = me and r.daily and r.result = 'victory' and r.day = today),
      'board', coalesce((select jsonb_agg(to_jsonb(q)) from (
        select r.party_size as "partySize", r.seconds, r.peril,
               (select jsonb_agg(pr.display_name order by pr.display_name)
                  from public.arena_raid_players rp join public.arena_profiles pr on pr.id = rp.player_id
                 where rp.run_id = r.id) as names
          from (select rr.*, row_number() over (partition by rr.party_size order by rr.seconds, rr.id) as place
                  from public.arena_raid_runs rr
                 where rr.daily and rr.result = 'victory' and rr.day = today) r
         where r.place <= 10
         order by r.party_size, r.seconds limit 40) q), '[]'::jsonb)),
    'dailyClears', coalesce((select jsonb_agg(distinct r.day order by r.day)
                               from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
                              where p.player_id = me and r.daily and r.result = 'victory'
                                and r.day between week_start and week_start + 6), '[]'::jsonb));
end; $$;
revoke all on function public.arena_raid_progress() from public, anon;
grant execute on function public.arena_raid_progress() to authenticated;

-- Shop collections and earned raid rewards share five independent slots.
create or replace function public.arena_equip_raid_slot(p_slot text, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); item_slot text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_slot is null or p_slot not in ('skin', 'aura', 'entrance', 'frame', 'victory') then
    raise exception 'Unknown slot';
  end if;
  if p_item is not null then
    select i.slot into item_slot from public.arena_shop_items i where i.id = p_item and i.kind = 'look';
    if found then
      if item_slot is distinct from p_slot then raise exception 'That item belongs in another slot'; end if;
      if not exists (select 1 from public.arena_owned_items o where o.player_id = me and o.item_id = p_item) then
        raise exception 'Cosmetic not earned';
      end if;
    else
      select w.slot into item_slot from public.arena_raid_rewards w where w.id = p_item and w.slot <> 'title';
      if not found then raise exception 'Unknown cosmetic'; end if;
      if item_slot is distinct from p_slot then raise exception 'That item belongs in another slot'; end if;
      if not exists (select 1 from public.arena_raid_earned(me) e where e = p_item) then
        raise exception 'Cosmetic not earned';
      end if;
    end if;
  end if;
  insert into public.arena_raid_loadouts(player_id) values (me) on conflict (player_id) do nothing;
  update public.arena_raid_loadouts set
    skin = case when p_slot = 'skin' then p_item else skin end,
    aura = case when p_slot = 'aura' then p_item else aura end,
    entrance = case when p_slot = 'entrance' then p_item else entrance end,
    frame = case when p_slot = 'frame' then p_item else frame end,
    victory = case when p_slot = 'victory' then p_item else victory end,
    cosmetic = null
  where player_id = me;
end; $$;
revoke all on function public.arena_equip_raid_slot(text, text) from public, anon;
grant execute on function public.arena_equip_raid_slot(text, text) to authenticated;

commit;

-- All three results should be true after running this entire file.
with collections(id) as (values ('candy'), ('galaxy'), ('retro'), ('festival'), ('garden'), ('winter')),
slots(suffix, slot) as (values ('colours', 'skin'), ('aura', 'aura'), ('entrance', 'entrance'), ('frame', 'frame'), ('victory', 'victory'))
select
  position('arena_shop_items' in pg_get_functiondef('public.arena_equip_raid_slot(text,text)'::regprocedure)) > 0 as collection_equipping_enabled,
  position('loadout.victory' in pg_get_functiondef('public.arena_raid_progress()'::regprocedure)) > 0 as five_slot_loadout_enabled,
  (select count(*) = 30 from collections c cross join slots s join public.arena_shop_items i on i.id = c.id || '-' || s.suffix and i.kind = 'look' and i.slot = s.slot) as collection_slots_valid;
