-- Hub redesign, phase 1: player levels 1–100, Daily Spark and a 30-tier season.
-- Run after 034_advisor_hardening.sql. Safe to run again: earned XP, coins,
-- titles, cosmetics and seasons are kept, and no reward is paid twice.
--  * Levels: Lv 1–50 keep their exact thresholds. Lv 51–100 are new; the steps
--    match xpToNextLevel in packages/shared/src/journey.ts. Every level from
--    Lv 50 pays 100 coins (30 below). New titles at Lv 60, 75, 90 and 100.
--  * Daily Spark: the first 500 XP each Pacific day count double. The bonus is
--    its own XP ledger row (source 'spark', ref '<source>:<ref>') and also
--    counts towards the season.
--  * Seasons: from the first month after this migration runs, 30 tiers of
--    1,200 XP, with the season's frame, aura, colors and finale at tiers
--    5, 12, 20 and 30. The month in progress keeps 20 tiers of 400 XP, so
--    nobody drops a tier in the middle of a season.
--  * Players whose saved XP is already past Lv 50 get their new level coins
--    and titles once.
begin;

-- XP from each level to the next, Lv 1→2 … Lv 99→100.
create or replace function public.arena_level_steps() returns integer[]
language sql immutable set search_path = '' as $$
  select array[
    100,125,150,175,200,225,250,275,300,325,
    350,375,400,425,450,475,500,525,550,575,
    600,625,650,675,700,725,750,775,800,825,
    850,875,900,925,950,975,1000,1025,1050,1075,
    1100,1125,1150,1175,1200,1225,1250,1275,1300,1450,
    1650,1900,2200,2500,2800,3150,3500,3850,4250,4600,
    5000,5450,5850,6250,6700,7150,7600,8050,8550,9075,
    9150,9225,9300,9375,9450,9525,9600,9675,9750,9825,
    9900,9975,10050,10125,10200,10275,10350,10425,10500,10575,
    10650,10725,10800,10875,10950,11025,11100,11175,11250
  ]::integer[]
$$;

-- Total XP needed to enter a level (1–100).
create or replace function public.arena_level_threshold(p_level integer) returns bigint
language sql immutable set search_path = '' as $$
  select coalesce(sum(s.step), 0)::bigint
    from unnest(public.arena_level_steps()) with ordinality as s(step, n)
   where s.n < greatest(1, least(100, coalesce(p_level, 1)))
$$;

-- The level a saved XP total reaches (1–100). XP keeps counting at the cap.
create or replace function public.arena_level_for(p_xp bigint) returns integer
language sql immutable set search_path = '' as $$
  select 1 + count(*)::integer from (
    select sum(s.step) over (order by s.n) as total
      from unnest(public.arena_level_steps()) with ordinality as s(step, n)
  ) t where t.total <= greatest(0, coalesce(p_xp, 0))
$$;

create or replace function public.arena_level_coins(p_level integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_level < 50 then 30 else 100 end
$$;

create or replace function public.arena_level_title(p_level integer) returns text
language sql immutable set search_path = '' as $$
  select case p_level
    when 5 then 'Rising Spark' when 30 then 'Arena Vanguard' when 50 then 'Elemental Legend'
    when 60 then 'Arena Veteran' when 75 then 'Mythic Champion' when 90 then 'Ascendant'
    when 100 then 'Element Master' else null end
$$;

revoke all on function public.arena_level_steps(), public.arena_level_threshold(integer),
  public.arena_level_for(bigint), public.arena_level_coins(integer), public.arena_level_title(integer)
  from public, anon, authenticated, service_role;

insert into public.arena_titles(name, description, color, active)
select v.name, v.description, '#9ff3d8', true from (values
  ('Arena Veteran', 'Reach player level 60.'),
  ('Mythic Champion', 'Reach player level 75.'),
  ('Ascendant', 'Reach player level 90.'),
  ('Element Master', 'Reach player level 100.')
) v(name, description)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Season rules by starting month (YYYY-MM). A season uses the latest row
-- that starts on or before it.
create table if not exists public.arena_season_rules (
  starts text primary key check (starts ~ '^[0-9]{4}-[0-9]{2}$'),
  tiers integer not null check (tiers between 1 and 100),
  tier_xp integer not null check (tier_xp between 1 and 100000),
  item_tiers integer[] not null check (array_length(item_tiers, 1) = 4)
);
alter table public.arena_season_rules enable row level security;
revoke all on public.arena_season_rules from public, anon, authenticated, service_role;
insert into public.arena_season_rules values ('2000-01', 20, 400, '{5,10,15,20}')
on conflict (starts) do nothing;
-- The 30-tier season starts with the month after this migration first runs.
insert into public.arena_season_rules
select to_char(date_trunc('month', public.arena_today()::timestamp) + interval '1 month', 'YYYY-MM'),
       30, 1200, '{5,12,20,30}'
where not exists (select 1 from public.arena_season_rules where tiers = 30 and tier_xp = 1200);

create or replace function public.arena_season_rule(p_season text) returns public.arena_season_rules
language sql stable security definer set search_path = public as $$
  select * from (
    select * from public.arena_season_rules where starts <= p_season
    union all select '0000-00', 20, 400, array[5, 10, 15, 20]
  ) r order by starts desc limit 1
$$;
revoke all on function public.arena_season_rule(text) from public, anon, authenticated, service_role;

create or replace function public.arena_add_season_xp(pid uuid, amount integer, ref text, d date) returns void
language plpgsql security definer set search_path=public as $$
declare sid text=to_char(d,'YYYY-MM'); old_xp bigint; new_xp bigint; inserted integer; tier integer; theme text; item text;
 r public.arena_season_rules; old_tier integer; new_tier integer;
begin
 if amount<=0 then return; end if;
 insert into public.arena_season_ledger values(pid,sid,ref) on conflict do nothing;
 get diagnostics inserted=row_count; if inserted=0 then return; end if;
 insert into public.arena_season_xp(player_id,season) values(pid,sid) on conflict do nothing;
 select xp into old_xp from public.arena_season_xp where player_id=pid and season=sid for update;
 -- A result plus its Daily Spark bonus can exceed one ledger row's 10,000.
 new_xp=least(2000000000,old_xp+least(20000,amount));
 update public.arena_season_xp set xp=new_xp where player_id=pid and season=sid;
 r=public.arena_season_rule(sid);
 theme=(array['aurora','ember','tide','astral'])[(extract(year from d)::int*12+extract(month from d)::int-1)%4+1];
 old_tier=least(r.tiers::bigint,old_xp/r.tier_xp)::integer;
 new_tier=least(r.tiers::bigint,new_xp/r.tier_xp)::integer;
 if new_tier>old_tier then
  for tier in old_tier+1..new_tier loop
   perform public.arena_grant(pid,50,'season',sid||':'||tier,d);
   item=(array['frame','aura','colors','victory'])[array_position(r.item_tiers,tier)];
   if item is not null then
    item='season-'||theme||'-'||item;
    if exists(select 1 from public.arena_owned_items where player_id=pid and item_id=item) then
     perform public.arena_grant(pid,100,'season-repeat',sid||':'||tier,d);
    else
     insert into public.arena_owned_items(player_id,item_id) values(pid,item) on conflict do nothing;
    end if;
   end if;
  end loop;
 end if;
end; $$;
revoke all on function public.arena_add_season_xp(uuid,integer,text,date) from public,anon,authenticated,service_role;

create or replace function public.arena_add_xp(pid uuid, amount integer, source text, ref text, d date) returns void
language plpgsql security definer set search_path=public as $$
declare old_xp bigint; new_xp bigint; before_level integer; after_level integer; l integer; inserted integer;
 item text; v_title text; base integer; bonus integer=0;
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
   item=case l when 10 then 'wayfarer-frame' when 15 then 'comet-arrival' when 20 then 'trailblazer-aura' when 25 then 'aurora-colors' when 35 then 'meteor-finale' when 40 then 'champion-laurel' when 45 then 'astral-aura' else null end;
   if item is not null then insert into public.arena_owned_items(player_id,item_id) values(pid,item) on conflict do nothing; end if;
   v_title=public.arena_level_title(l);
   if v_title is not null then
    insert into public.arena_player_titles(player_id,title_id) select pid,id from public.arena_titles where name=v_title on conflict do nothing;
   end if;
  end loop;
 end if;
 perform public.arena_add_season_xp(pid,base+bonus,'xp:'||source||':'||ref,d);
end; $$;
revoke all on function public.arena_add_xp(uuid,integer,text,text,date) from public,anon,authenticated,service_role;

create or replace function public.arena_journey() returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid=auth.uid(); d date=public.arena_today(); w date; sid text=to_char(d,'YYYY-MM'); r public.arena_season_rules;
begin
 if me is null or not exists(select 1 from public.arena_profiles where id=me and not suspended) then raise exception 'Login required'; end if;
 w=d-(extract(isodow from d)::int-1);
 r=public.arena_season_rule(sid);
 return jsonb_build_object(
  'xp',coalesce((select xp from public.arena_player_xp where player_id=me),0),
  'recent',coalesce((select jsonb_agg(to_jsonb(x)) from (select ref,amount,source,created_at as at from public.arena_xp_ledger where player_id=me order by created_at desc,ref limit 20) x),'[]'::jsonb),
  'season',jsonb_build_object('id',sid,'xp',coalesce((select xp from public.arena_season_xp where player_id=me and season=sid),0),'week',w,
   'goals',coalesce((select jsonb_build_object('play',play,'skills',skills,'raids',raids,'arcade',arcade) from public.arena_weekly_goals where player_id=me and week=w),'{}'::jsonb),
   'completed',coalesce((select to_jsonb(completed) from public.arena_weekly_goals where player_id=me and week=w),'[]'::jsonb),
   'tiers',r.tiers,'tierXp',r.tier_xp,'itemTiers',to_jsonb(r.item_tiers)),
  'spark',jsonb_build_object('day',d,'limit',500,
   'used',coalesce((select sum(amount) from public.arena_xp_ledger where player_id=me and source='spark' and day=d),0)),
  'unlocked',coalesce((select jsonb_agg(o.item_id order by o.item_id) from public.arena_owned_items o join public.arena_shop_items i on i.id=o.item_id where o.player_id=me and i.kind='look' and not i.active),'[]'::jsonb));
end; $$;
revoke all on function public.arena_journey() from public,anon;
grant execute on function public.arena_journey() to authenticated;

-- Saved XP already past Lv 50: pay the new levels once (ledger refs make this idempotent).
do $$
declare p record; l integer; v_title text; d date=public.arena_today();
begin
 for p in select x.player_id, x.xp from public.arena_player_xp x
   join public.arena_profiles pr on pr.id=x.player_id and not pr.suspended
  where x.xp>=public.arena_level_threshold(51) loop
  for l in 51..public.arena_level_for(p.xp) loop
   perform public.arena_grant(p.player_id,public.arena_level_coins(l),'level',l::text,d);
   v_title=public.arena_level_title(l);
   if v_title is not null then
    insert into public.arena_player_titles(player_id,title_id)
    select p.player_id,id from public.arena_titles where name=v_title on conflict do nothing;
   end if;
  end loop;
 end loop;
end $$;
commit;

select
  public.arena_level_threshold(50) = 34300 and public.arena_level_threshold(100) = 431625 as level_100_enabled,
  position('spark' in pg_get_functiondef('public.arena_add_xp(uuid,integer,text,text,date)'::regprocedure)) > 0 as daily_spark_enabled,
  (select starts from public.arena_season_rules where tiers = 30 and tier_xp = 1200) as thirty_tier_season_starts;
