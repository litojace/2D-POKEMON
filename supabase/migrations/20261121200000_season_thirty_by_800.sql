-- The 30-tier season (migration 035) takes 800 XP a tier instead of 1,200
-- (docs/economy-review.md §2.3). At 1,200, a player at the median of season
-- XP a day earned ~150 fewer season coins a month than in the 20 × 400
-- season, and one at p25 ~450 fewer; at 800 they earn about the same or more,
-- and the most active still reach tier 30 (1,500 coins).
--
-- Safe to run again: the update only touches 1,200-XP rows, and the catch-up
-- pays each (player, tier) once (arena_grant is keyed by reason and ref).
begin;

update public.arena_season_rules set tier_xp = 800
 where tiers = 30 and tier_xp = 1200;

-- Migration 035 inserts its 30 × 1,200 row whenever none exists, so run
-- again it would insert that month a second time (a duplicate key) or bring
-- 1,200 back. Its rows arrive at 800 now, and a month already ruled is kept.
create or replace function public.arena_season_rules_800() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.tiers = 30 and new.tier_xp = 1200 then new.tier_xp = 800; end if;
  if exists (select 1 from public.arena_season_rules where starts = new.starts) then
    return null;
  end if;
  return new;
end; $$;
revoke all on function public.arena_season_rules_800() from public, anon, authenticated, service_role;
drop trigger if exists arena_season_rules_800 on public.arena_season_rules;
create trigger arena_season_rules_800 before insert on public.arena_season_rules
  for each row execute function public.arena_season_rules_800();

-- Catch-up, for a run after a 30-tier season has started: a lower tier_xp
-- puts players above tiers they were never paid for, and arena_add_season_xp
-- only pays tiers past the new count. Pay those tiers here, as it would have:
-- 50 coins, and the tier's cosmetic (or 100 coins if already owned).
do $$
declare
  sid text = to_char(public.arena_today(), 'YYYY-MM');
  r public.arena_season_rules = public.arena_season_rule(sid);
  theme text = (array['aurora','ember','tide','astral'])[
    (extract(year from public.arena_today())::int * 12
      + extract(month from public.arena_today())::int - 1) % 4 + 1];
  p record; tier integer; item text; d date = public.arena_today();
begin
  if r.tier_xp <> 800 then return; end if;
  for p in select player_id, xp from public.arena_season_xp where season = sid loop
    for tier in 1..least(r.tiers::bigint, p.xp / r.tier_xp)::integer loop
      continue when exists (select 1 from public.arena_coin_ledger
        where player_id = p.player_id and reason = 'season' and ref = sid || ':' || tier);
      perform public.arena_grant(p.player_id, 50, 'season', sid || ':' || tier, d);
      item = (array['frame','aura','colors','victory'])[array_position(r.item_tiers, tier)];
      if item is not null then
        item = 'season-' || theme || '-' || item;
        if exists (select 1 from public.arena_owned_items where player_id = p.player_id and item_id = item) then
          perform public.arena_grant(p.player_id, 100, 'season-repeat', sid || ':' || tier, d);
        else
          insert into public.arena_owned_items(player_id, item_id) values (p.player_id, item)
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end loop;
end $$;

commit;
