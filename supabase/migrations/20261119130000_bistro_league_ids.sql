-- The Bistro's weekly league and today's friend guests carry each player's
-- id, so their rows show the player's avatar (docs/hidden-picks.md,
-- "Avatars"; the client points them at /api/avatar/of/<id>).
-- Run after 20261119120000_avatars_everywhere.sql. Safe to run again.
--
-- arena_bistro_state_base is 103's arena_bistro_state, renamed by 118
-- (whose wrapper adds 'held'; 20261117100001 wraps that again, as
-- arena_bistro_state_coop, adding eggs). Only the two 'id' keys are new.

begin;

create or replace function public.arena_bistro_state_base(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.arena_bistros; t timestamptz = now(); d date = public.arena_today();
  wk date = date_trunc('week', public.arena_today())::date; lw date = (date_trunc('week', public.arena_today()) - interval '7 days')::date;
  my_last integer;
begin
  select * into b from public.arena_bistros where player_id = pid;
  my_last = coalesce((select points from public.arena_bistro_week where player_id = pid and week = lw), 0);
  return jsonb_build_object(
    'v', 1,
    'now', (extract(epoch from t) * 1000)::bigint,
    'coins', b.coins, 'xp', b.xp, 'level', b.level,
    'rating', round(b.rating::numeric, 3), 'served', b.served,
    'floor', b.floor, 'wall', b.wall, 'floors', to_jsonb(b.floors), 'walls', to_jsonb(b.walls),
    'kitchenLv', b.kitchen_lv, 'shiftLv', b.shift_lv, 'sizeLv', b.size_lv, 'chef', b.chef, 'likes', b.likes,
    'likesWeek', public.arena_bistro_likes_week(pid),
    'trash', b.trash,
    'stars', b.stars, 'tokens', b.tokens,
    'event', public.arena_bistro_event(d),
    'regulars', coalesce((select jsonb_object_agg(rid, step) from public.arena_bistro_regulars where player_id = pid), '{}'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', slot, 'dishes', dishes, 'coins', coins, 'xp', xp,
        'tokens', tokens, 'filled', filled, 'expires', coalesce((extract(epoch from expires_at) * 1000)::bigint, 0),
        'next', coalesce((extract(epoch from next_at) * 1000)::bigint, 0)) order by slot)
      from public.arena_bistro_orders where player_id = pid), '[]'::jsonb),
    'league', jsonb_build_object(
      'week', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'fighter', p.portrait_character,
          'points', coalesce(w.points, 0), 'me', p.id = pid) order by coalesce(w.points, 0) desc, lower(p.display_name))
        from public.arena_profiles p
        left join public.arena_bistro_week w on w.player_id = p.id and w.week = wk
        where p.id = pid or (public.arena_farm_are_friends(pid, p.id) and exists (select 1 from public.arena_bistros x where x.player_id = p.id))),
        '[]'::jsonb),
      'last', case when my_last > 0 then jsonb_build_object('points', my_last,
          'rank', 1 + (select count(*) from public.arena_bistro_week w2 where w2.week = lw and w2.points > my_last
            and public.arena_farm_are_friends(pid, w2.player_id)),
          'claimed', exists (select 1 from public.arena_bistro_league_claims c where c.player_id = pid and c.week = lw))
        end),
    'dishLv', coalesce((select jsonb_object_agg(dish, jsonb_build_object('lv', lv, 'mastery', mastery))
      from public.arena_bistro_dish_lv where player_id = pid), '{}'::jsonb),
    'pantry', coalesce((select jsonb_object_agg(ingredient, qty) from public.arena_bistro_pantry
      where player_id = pid and qty > 0), '{}'::jsonb),
    'marketBought', coalesce((select jsonb_object_agg(ingredient, qty) from public.arena_bistro_market
      where player_id = pid and day = d), '{}'::jsonb),
    'farmSent', coalesce((select qty from public.arena_bistro_farm_sent where player_id = pid and day = d), 0),
    'farmCrops', coalesce((select jsonb_object_agg(crop, qty) from public.arena_farm_barn
      where player_id = pid and mutation = '' and qty > 0
        and crop in ('wheat', 'mint', 'pepper', 'lotus', 'milk')), '{}'::jsonb),
    'lastSeen', coalesce((extract(epoch from b.last_seen) * 1000)::bigint, 0),
    'special', public.arena_bistro_special(b.level, d),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'x', x, 'y', y, 'rot', rot) order by id)
      from public.arena_bistro_items where player_id = pid), '[]'::jsonb),
    'nextId', coalesce((select max(id) from public.arena_bistro_items where player_id = pid), 0) + 1,
    'stored', coalesce((select jsonb_object_agg(kind, qty) from public.arena_bistro_stored
      where player_id = pid and qty > 0), '{}'::jsonb),
    'stoveStore', coalesce((select jsonb_object_agg(model, qty) from public.arena_bistro_stove_store
      where player_id = pid and qty > 0), '{}'::jsonb),
    'stoves', (select jsonb_agg(case when dish is null then jsonb_build_object('dish', null, 'start', 0, 'perfect', false)
        else jsonb_build_object('dish', dish, 'start', (extract(epoch from started_at) * 1000)::bigint,
          'perfect', perfect, 'dur', dur_ms) end || jsonb_build_object('x', x, 'model', model) order by idx)
      from public.arena_bistro_stoves where player_id = pid),
    'counter', (select jsonb_agg(case when dish is null then 'null'::jsonb
        else jsonb_build_object('dish', dish, 'servings', servings, 'perfect', perfect) end order by slot)
      from public.arena_bistro_counter where player_id = pid),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', s.id,
        'char', coalesce(fp.portrait_character, s.creature), 'role', s.role,
        'level', s.level, 'dish', s.dish,
        'energy', coalesce(s.energy, public.arena_bistro_energy_max(s.level)),
        'fedAt', coalesce((extract(epoch from s.fed_at) * 1000)::bigint, 0))
        || case when fp.id is null then '{}'::jsonb
          else jsonb_build_object('friend', jsonb_build_object('id', fp.id, 'name', fp.display_name)) end
        order by s.id)
      from public.arena_bistro_staff s left join public.arena_profiles fp on fp.id = s.friend_id
      where s.player_id = pid), '[]'::jsonb),
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = pid), 0),
    'tradedToday', coalesce((select sum(amount) from public.arena_leaf_ledger
      where player_id = pid and day = d and reason = 'bistro-trade'), 0),
    -- Friends who ate here today, newest first.
    'friendGuests', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name,
        'fighter', p.portrait_character, 'dish', x.dish) order by x.created_at desc)
      from public.arena_bistro_dines x join public.arena_profiles p on p.id = x.diner
      where x.owner = pid and x.day = d), '[]'::jsonb),
    'dinesToday', (select count(*) from public.arena_bistro_dines where diner = pid and day = d));
end; $$;
revoke all on function public.arena_bistro_state_base(uuid)
  from public, anon, authenticated, service_role;

commit;
notify pgrst, 'reload schema';
