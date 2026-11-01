-- Raids have one difficulty: every raid is Peril 3 from now on.
-- Peril milestones become clear counts (entrance on the 1st clear, title and
-- frame on the 3rd). A clear on that Peril before this change still earns
-- them (rule.legacyPeril), so nothing anyone earned is lost. Solo raiders now
-- keep one self-revive, so "solo without going down" needs a clear with no
-- downs from here on. Two missions that named a Peril get new goals.
begin;

update public.arena_missions
set text = 'Clear 2 raids on your own', metric = 'raid-solo', target = 2
where id = 'raid-p3';
update public.arena_missions
set text = 'Clear 2 raids with no downs', metric = 'raid-flawless', target = 2
where id = 'raid-solo-p2';

update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'lightning-strike';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'eye-of-the-storm';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'conductor-frame';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'firefall';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'wingbreaker';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'brazier-frame';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'sunburst';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'sunshatter';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'stained-glass';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'mountainborn';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'mountain-conqueror';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'conqueror';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'riptide';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'leviathans-bane';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'reef';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'shadowstep';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'nights-end';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'crescent';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":1,"legacyPeril":2}' where id = 'dreamdrift';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'lucid-legend';
update public.arena_raid_rewards set rule = '{"kind":"clears","n":3,"legacyPeril":3}' where id = 'moonglass';

create or replace function public.arena_raid_earned(pid uuid) returns setof text
language sql stable security definer set search_path = public as $$
  with runs as (
    select r.boss, r.result, r.peril, r.party_size, r.seconds, r.downs, r.gilded,
           r.feat, r.day, r.created_at, p.pillars, p.revives
      from public.arena_raid_runs r
      join public.arena_raid_players p on p.run_id = r.id
     where p.player_id = pid
  )
  select w.id from public.arena_raid_rewards w
   where w.active and case w.rule->>'kind'
    when 'clears' then
      (select count(*) from runs where result = 'victory' and boss = w.boss) >= (w.rule->>'n')::int
      or (w.rule ? 'legacyPeril' and exists (
        select 1 from runs where result = 'victory' and boss = w.boss
           and peril >= (w.rule->>'legacyPeril')::int
           and created_at < timestamptz '2026-11-01 05:50:00+00'))
    when 'peril' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss
                 and peril >= (w.rule->>'n')::int)
    when 'flawless' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss
                 and peril >= (w.rule->>'peril')::int and downs = 0)
    -- Before one-difficulty raids, solo Peril 3 had no self-revive (day is
    -- set from that migration on). Since then a solo clear needs no downs.
    when 'solo' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss and party_size = 1
                 and peril >= (w.rule->>'peril')::int
                 and (downs = 0 or (day is not null and created_at < timestamptz '2026-11-01 05:50:00+00')))
    when 'speed' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss
                 and peril >= (w.rule->>'peril')::int
                 and party_size = (w.rule->>'party')::int
                 and seconds <= (w.rule->>'seconds')::numeric)
    when 'gilded' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss and gilded)
    when 'feat' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss and feat)
    when 'stat' then
      coalesce((select sum(case w.rule->>'stat' when 'pillars' then pillars
                                                 when 'revives' then revives else 0 end)
                  from runs where boss = w.boss), 0) >= (w.rule->>'n')::int
    when 'total-clears' then
      (select count(*) from runs where result = 'victory') >= (w.rule->>'n')::int
    else false end;
$$;
revoke all on function public.arena_raid_earned(uuid) from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
