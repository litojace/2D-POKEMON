-- Somnara: Cloud Deck, private Dream Sequences and the fourth raid reward ladder.
-- Shared rules and slot validation are handled by migration 009's reward table.
begin;
update public.arena_raid_bosses set playable = true where id = 'somnara';
insert into public.arena_raid_rewards(id, boss, slot, name, rule) values
  ('dreamwaker', 'somnara', 'title', 'Dreamwaker', '{"kind":"clears","n":1}'),
  ('twilight-colors', 'somnara', 'skin', 'Twilight colors', '{"kind":"clears","n":5}'),
  ('starlit-skin', 'somnara', 'skin', 'Starlit skin', '{"kind":"clears","n":10}'),
  ('dreamdrift', 'somnara', 'entrance', 'Dreamdrift entrance', '{"kind":"peril","n":2}'),
  ('lucid-legend', 'somnara', 'title', 'Lucid Legend', '{"kind":"peril","n":3}'),
  ('moonglass', 'somnara', 'frame', 'Moonglass frame', '{"kind":"peril","n":3}'),
  ('lullaby-aura', 'somnara', 'aura', 'Lullaby aura', '{"kind":"flawless","peril":3}'),
  ('sweet-dreams', 'somnara', 'victory', 'Sweet Dreams', '{"kind":"feat"}'),
  ('daydream-dash', 'somnara', 'title', 'Daydream Dash', '{"kind":"speed","peril":2,"party":1,"seconds":240}'),
  ('lone-dreamer', 'somnara', 'title', 'Lone Dreamer', '{"kind":"solo","peril":3}'),
  ('dream-weaver', 'somnara', 'title', 'Dream Weaver', '{"kind":"stat","stat":"pillars","n":60}')
on conflict (id) do update set boss = excluded.boss, slot = excluded.slot, name = excluded.name, rule = excluded.rule;
insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Dreamwaker', 'First clear.', '#c9a3ff'),
  ('Lucid Legend', 'Clear Peril 3.', '#c9a3ff'),
  ('Daydream Dash', 'Clear Peril 2 solo in under 4:00.', '#c9a3ff'),
  ('Lone Dreamer', 'Clear Peril 3 solo (no self-revive).', '#c9a3ff'),
  ('Dream Weaver', 'Step 60 correct runes (wins and losses).', '#9fe8dd')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);
-- Rune steps can exceed the old 20-feature cap in a normal raid. Keep the
-- original cap for other bosses, and bound Somnara to 300 correct steps.
create or replace function public.arena_record_raid(p_receipt jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  player jsonb; pid uuid; inserted integer;
  outcome text = coalesce(p_receipt->>'result', 'victory');
  run uuid = (p_receipt->>'id')::uuid;
  peril integer = (p_receipt->>'peril')::integer;
  is_daily boolean = coalesce((p_receipt->>'daily')::boolean, false);
begin
  if not exists (select 1 from public.arena_raid_bosses b
                  where b.id = p_receipt->>'boss' and b.playable)
     or jsonb_array_length(p_receipt->'players') not between 1 and 4
     or outcome not in ('victory', 'defeat')
     or (is_daily and p_receipt->>'day' is null) then
    raise exception 'Invalid raid';
  end if;
  insert into public.arena_raid_runs(id, boss, peril, trait, gilded, weekly, week, party_size,
      seconds, downs, revives, receipt, created_at, result, phase_reached, down_causes,
      daily, day, feat)
  values (run, p_receipt->>'boss', peril, p_receipt->>'trait',
      (p_receipt->>'gilded')::boolean, coalesce((p_receipt->>'weekly')::boolean, false),
      coalesce((p_receipt->>'week')::date, (p_receipt->>'day')::date, current_date),
      (p_receipt->>'partySize')::integer, (p_receipt->>'seconds')::numeric,
      (p_receipt->>'downs')::integer, (p_receipt->>'revives')::integer, p_receipt, now(),
      outcome, least(3, greatest(1, coalesce((p_receipt->>'phaseReached')::integer, 3))),
      case when jsonb_typeof(p_receipt->'downCauses') = 'object' then p_receipt->'downCauses' else '{}'::jsonb end,
      is_daily, (p_receipt->>'day')::date,
      outcome = 'victory' and coalesce((p_receipt->>'feat')::boolean, false))
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  for player in select * from jsonb_array_elements(p_receipt->'players') loop
    pid = (player->>'accountId')::uuid;
    insert into public.arena_raid_players(run_id, player_id, character, damage, revives, pillars, downs)
    values (run, pid, player->>'character',
      least(1000000, greatest(0, coalesce((player->>'damage')::numeric, 0)))::integer,
      least(100, greatest(0, coalesce((player->>'revives')::integer, 0))),
      least(case when p_receipt->>'boss' = 'somnara' then 300 else 20 end, greatest(0, coalesce((player->>'pillars')::integer, 0))),
      least(100, greatest(0, coalesce((player->>'downs')::integer, 0))));
    -- Every title rule (first clear, Peril 3, speed, lifetime stats…) at once.
    insert into public.arena_player_titles(player_id, title_id)
    select pid, t.id
      from public.arena_raid_rewards w
      join public.arena_titles t on t.name = w.name
     where w.slot = 'title' and w.id in (select public.arena_raid_earned(pid))
    on conflict do nothing;
  end loop;
end; $$;
revoke all on function public.arena_record_raid(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_raid(jsonb) to service_role;

commit;
