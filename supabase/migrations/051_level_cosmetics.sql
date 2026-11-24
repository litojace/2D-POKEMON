-- Hub redesign: the Journey's Lv 55–100 cosmetics (docs/hub-redesign/PLAN.md,
-- decision 10). Run after 050_farm_giants.sql (it doesn't depend on it).
-- Safe to run again: no coins, XP or titles change, and nothing is granted
-- twice.
--  * Seven reward-only cosmetics (never sold, never in Today's Picks):
--    Prism frame (Lv 55), Nova entrance (65), Starlit colors (70), Solar aura
--    (80), Eclipse finale (85), Prismatic laurel (95) and the Element Master
--    frame (100, with the Element Master title). The ids match LEVEL_ITEMS in
--    packages/shared/src/journey.ts.
--  * arena_level_item(level) names each level's cosmetic, Lv 10–100.
--  * arena_add_xp (035) grants it on the way up, as before. It now also
--    hands back any level cosmetic a player is missing each time it saves XP,
--    so a result saved while this migration runs can't leave a gap.
--  * Everyone whose saved XP is already past a level gets its cosmetic now.
begin;

insert into public.arena_shop_items(id, kind, slot, name, rarity, price, active) values
  ('prism-frame', 'look', 'frame', 'Prism frame', 'mythical', 0, false),
  ('nova-entrance', 'look', 'entrance', 'Nova entrance', 'mythical', 0, false),
  ('starlit-colors', 'look', 'skin', 'Starlit colors', 'mythical', 0, false),
  ('solar-aura', 'look', 'aura', 'Solar aura', 'mythical', 0, false),
  ('eclipse-finale', 'look', 'victory', 'Eclipse finale', 'mythical', 0, false),
  ('prismatic-laurel', 'look', 'frame', 'Prismatic laurel', 'mythical', 0, false),
  ('element-master-frame', 'look', 'frame', 'Element Master frame', 'mythical', 0, false)
on conflict (id) do update set kind = excluded.kind, slot = excluded.slot, name = excluded.name,
  rarity = excluded.rarity, price = 0, active = false;

-- The cosmetic for reaching a level (LEVEL_MILESTONES in journey.ts).
create or replace function public.arena_level_item(p_level integer) returns text
language sql immutable set search_path = '' as $$
  select case p_level
    when 10 then 'wayfarer-frame' when 15 then 'comet-arrival' when 20 then 'trailblazer-aura'
    when 25 then 'aurora-colors' when 35 then 'meteor-finale' when 40 then 'champion-laurel'
    when 45 then 'astral-aura' when 55 then 'prism-frame' when 65 then 'nova-entrance'
    when 70 then 'starlit-colors' when 80 then 'solar-aura' when 85 then 'eclipse-finale'
    when 95 then 'prismatic-laurel' when 100 then 'element-master-frame' else null end
$$;
revoke all on function public.arena_level_item(integer) from public, anon, authenticated, service_role;

-- 035's arena_add_xp; only the cosmetic grant changed (see the header).
create or replace function public.arena_add_xp(pid uuid, amount integer, source text, ref text, d date) returns void
language plpgsql security definer set search_path=public as $$
declare old_xp bigint; new_xp bigint; before_level integer; after_level integer; l integer; inserted integer;
 v_title text; base integer; bonus integer=0;
begin
 if amount<=0 or source='spark' or not exists(select 1 from public.arena_profiles where id=pid and not suspended) then return; end if;
 base=least(10000,amount);
 insert into public.arena_xp_ledger values(pid,source,ref,base,d,now()) on conflict do nothing;
 get diagnostics inserted=row_count; if inserted=0 then return; end if;
 insert into public.arena_player_xp(player_id) values(pid) on conflict do nothing;
 select xp into old_xp from public.arena_player_xp where player_id=pid for update;
 -- Daily Spark, read after the row lock so simultaneous results share one allowance.
 bonus=least(base::bigint,greatest(0,500-coalesce((select sum(x.amount) from public.arena_xp_ledger x
   where x.player_id=pid and x.source='spark' and x.day=d),0)))::integer;
 if bonus>0 then
  insert into public.arena_xp_ledger values(pid,'spark',source||':'||ref,bonus,d,now()) on conflict do nothing;
  get diagnostics inserted=row_count; if inserted=0 then bonus=0; end if;
 end if;
 new_xp=least(2000000000,old_xp+base+bonus);
 update public.arena_player_xp set xp=new_xp where player_id=pid;
 before_level=public.arena_level_for(old_xp);after_level=public.arena_level_for(new_xp);
 if after_level>before_level then
  for l in before_level+1..after_level loop
   perform public.arena_grant(pid,public.arena_level_coins(l),'level',l::text,d);
   v_title=public.arena_level_title(l);
   if v_title is not null then
    insert into public.arena_player_titles(player_id,title_id) select pid,id from public.arena_titles where name=v_title on conflict do nothing;
   end if;
  end loop;
 end if;
 -- Every level cosmetic up to the player's level: new ones on a level-up,
 -- and any the player is missing.
 insert into public.arena_owned_items(player_id,item_id)
 select pid,i.item from generate_series(10,after_level) lv, public.arena_level_item(lv) as i(item)
  where i.item is not null
 on conflict do nothing;
 perform public.arena_add_season_xp(pid,base+bonus,'xp:'||source||':'||ref,d);
end; $$;
revoke all on function public.arena_add_xp(uuid,integer,text,text,date) from public,anon,authenticated,service_role;

-- Backfill: everyone already past a level owns its cosmetic. Only cosmetics:
-- no coins, XP or titles. Suspended accounts are included, so a lifted
-- suspension finds them in place.
insert into public.arena_owned_items(player_id, item_id)
select x.player_id, i.item
  from public.arena_player_xp x
  cross join lateral generate_series(10, public.arena_level_for(x.xp)) lv
  cross join lateral public.arena_level_item(lv) as i(item)
 where i.item is not null
on conflict do nothing;

commit;

-- All three should be true after running this file.
select
  (select count(*) from public.arena_shop_items
    where id in ('prism-frame', 'nova-entrance', 'starlit-colors', 'solar-aura', 'eclipse-finale',
                 'prismatic-laurel', 'element-master-frame')
      and kind = 'look' and price = 0 and not active) = 7 as level_cosmetics_seeded,
  position('arena_level_item' in pg_get_functiondef('public.arena_add_xp(uuid,integer,text,text,date)'::regprocedure)) > 0
    as level_cosmetics_granted,
  not exists (
    select 1 from public.arena_player_xp x
      cross join lateral generate_series(10, public.arena_level_for(x.xp)) lv
      cross join lateral public.arena_level_item(lv) as i(item)
     where i.item is not null
       and not exists (select 1 from public.arena_owned_items o where o.player_id = x.player_id and o.item_id = i.item)
  ) as everyone_past_a_level_owns_it;
