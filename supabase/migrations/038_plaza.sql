-- Hub redesign, phase 3: the new Plaza's Gold Leaves features.
-- Run after 037_farm.sql. Safe to run again.
--  * "Plaza today": five daily quests (goal, lap under 30 s, 15 runway cheers,
--    10 Orb Shower orbs, the Photo Spot), paid automatically once per Pacific
--    day: 30 / 40 / 30 / 25 / 15 Gold Leaves.
--  * Orb Shower: +2 leaves per orb, at most 10 paying orbs per shower and 50 a
--    Pacific day.
--  * TOP DASH: each player's best lap of the (Pacific, Monday) week.
--  * Volt Boba: 10 Gold Leaves, spent once per request id.
-- Only the game server reports Plaza events (arena_plaza_record, service
-- role): it runs the movement, the ball, the orbs and the lap timer. Players
-- read their own progress (arena_plaza) and buy boba (arena_plaza_boba).
begin;

create table if not exists public.arena_plaza_days (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  goal integer not null default 0,
  lap integer not null default 0,
  cheers integer not null default 0,
  orbs integer not null default 0,
  photo integer not null default 0,
  primary key (player_id, day)
);
create table if not exists public.arena_plaza_laps (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  best_ms integer not null check (best_ms between 1000 and 600000),
  set_at timestamptz not null default now(),
  primary key (player_id, week)
);
create index if not exists arena_plaza_laps_board on public.arena_plaza_laps(week, best_ms);
alter table public.arena_plaza_days enable row level security;
alter table public.arena_plaza_laps enable row level security;
revoke all on public.arena_plaza_days, public.arena_plaza_laps from public, anon, authenticated, service_role;

-- The quests: id → (needed, leaves). Same numbers as PLAZA_QUESTS in packages/shared.
create or replace function public.arena_plaza_quests()
returns table(id text, needed integer, leaves integer)
language sql immutable set search_path = public as $$
  values ('goal', 1, 30), ('lap', 1, 40), ('cheers', 15, 30), ('orbs', 10, 25), ('photo', 1, 15)
$$;
revoke all on function public.arena_plaza_quests() from public, anon, authenticated, service_role;

-- The Monday of a Pacific day.
create or replace function public.arena_plaza_week(d date) returns date
language sql immutable set search_path = public as $$
  select d - (extract(isodow from d)::int - 1)
$$;
revoke all on function public.arena_plaza_week(date) from public, anon, authenticated, service_role;

-- One player's Plaza progress today and this week's TOP DASH board.
create or replace function public.arena_plaza_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date = public.arena_today(); w date = public.arena_plaza_week(public.arena_today()); t public.arena_plaza_days;
begin
  select * into t from public.arena_plaza_days where player_id = pid and day = d;
  return jsonb_build_object(
    'day', d,
    'quests', (select jsonb_object_agg(q.id, jsonb_build_object(
        'n', least(q.needed, case q.id when 'goal' then coalesce(t.goal, 0) when 'lap' then coalesce(t.lap, 0)
          when 'cheers' then coalesce(t.cheers, 0) when 'orbs' then coalesce(t.orbs, 0) else coalesce(t.photo, 0) end),
        'done', exists (select 1 from public.arena_leaf_ledger l where l.player_id = pid and l.reason = 'plaza-quest'
          and l.ref = d::text || ':' || q.id)))
      from public.arena_plaza_quests() q),
    'orbsToday', (select count(*) from public.arena_leaf_ledger l where l.player_id = pid and l.day = d and l.reason = 'plaza-orb'),
    'bestLapMs', (select best_ms from public.arena_plaza_laps where player_id = pid and week = w),
    'board', coalesce((select jsonb_agg(jsonb_build_object('name', b.display_name, 'ms', b.best_ms, 'me', b.player_id = pid) order by b.best_ms, b.set_at)
      from (select l.player_id, l.best_ms, l.set_at, p.display_name from public.arena_plaza_laps l
        join public.arena_profiles p on p.id = l.player_id and not p.suspended
        where l.week = w order by l.best_ms, l.set_at limit 5) b), '[]'::jsonb),
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = pid), 0));
end; $$;
revoke all on function public.arena_plaza_state(uuid) from public, anon, authenticated, service_role;

-- The caller's own progress.
create or replace function public.arena_plaza() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  return public.arena_plaza_state(auth.uid());
end; $$;
revoke all on function public.arena_plaza() from public, anon;
grant execute on function public.arena_plaza() to authenticated;

-- Record something the game server saw happen in the Plaza:
--   {player, kind: orb|goal|lap|cheers|photo, ref (orb only), ms (lap), n (cheers)}
-- Pays any quest that is now complete (once a day) and returns the progress.
create or replace function public.arena_plaza_record(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; k text = p->>'kind'; v_ref text = p->>'ref'; d date = public.arena_today();
  ms integer; n integer; t public.arena_plaza_days; q record; have integer;
begin
  begin pid = (p->>'player')::uuid; exception when others then raise exception 'Bad player'; end;
  if pid is null or not exists (select 1 from public.arena_profiles where id = pid and not suspended) then
    return null;
  end if;
  insert into public.arena_plaza_days(player_id, day) values (pid, d) on conflict do nothing;
  -- One Plaza record at a time per player, so the caps hold.
  select * into t from public.arena_plaza_days where player_id = pid and day = d for update;
  if k = 'orb' then
    -- ref: "<shower start, in UTC minutes>-<orb id>".
    if v_ref is null or v_ref !~ '^[0-9]{6,12}-[0-9]{1,9}$' then raise exception 'Bad orb'; end if;
    if (select count(*) from public.arena_leaf_ledger l
         where l.player_id = pid and l.day = d and l.reason = 'plaza-orb') < 50
       and (select count(*) from public.arena_leaf_ledger l
         where l.player_id = pid and l.reason = 'plaza-orb' and l.ref like split_part(v_ref, '-', 1) || '-%') < 10
       and public.arena_grant_leaves(pid, 2, 'plaza-orb', v_ref, d) then
      update public.arena_plaza_days set orbs = orbs + 1 where player_id = pid and day = d;
    end if;
  elsif k = 'goal' then
    update public.arena_plaza_days set goal = 1 where player_id = pid and day = d;
  elsif k = 'photo' then
    update public.arena_plaza_days set photo = 1 where player_id = pid and day = d;
  elsif k = 'cheers' then
    n = least(15, greatest(0, coalesce((p->>'n')::integer, 0)));
    update public.arena_plaza_days set cheers = greatest(cheers, n) where player_id = pid and day = d;
  elsif k = 'lap' then
    ms = (p->>'ms')::integer;
    if ms is null or ms < 1000 or ms > 600000 then raise exception 'Bad lap'; end if;
    insert into public.arena_plaza_laps(player_id, week, best_ms) values (pid, public.arena_plaza_week(d), ms)
    on conflict (player_id, week) do update set best_ms = excluded.best_ms, set_at = now()
      where excluded.best_ms < public.arena_plaza_laps.best_ms;
    if ms < 30000 then update public.arena_plaza_days set lap = 1 where player_id = pid and day = d; end if;
  else
    raise exception 'Unknown Plaza event';
  end if;
  select * into t from public.arena_plaza_days where player_id = pid and day = d;
  for q in select * from public.arena_plaza_quests() loop
    have = case q.id when 'goal' then t.goal when 'lap' then t.lap when 'cheers' then t.cheers
      when 'orbs' then t.orbs else t.photo end;
    if have >= q.needed then
      perform public.arena_grant_leaves(pid, q.leaves, 'plaza-quest', d::text || ':' || q.id, d);
    end if;
  end loop;
  return public.arena_plaza_state(pid);
end; $$;
revoke all on function public.arena_plaza_record(jsonb) from public, anon, authenticated;
grant execute on function public.arena_plaza_record(jsonb) to service_role;

-- Volt Boba: 10 Gold Leaves. The game server sends a fresh id per purchase,
-- so a retried request never charges twice; it applies the speed itself.
create or replace function public.arena_plaza_boba(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); paid boolean;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_ref is null or p_ref !~ '^[0-9a-f-]{36}$' then raise exception 'Bad request'; end if;
  paid = public.arena_spend_leaves(me, 10, 'plaza-boba', p_ref, d);
  return jsonb_build_object('ok', paid,
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = me), 0));
end; $$;
revoke all on function public.arena_plaza_boba(text) from public, anon;
grant execute on function public.arena_plaza_boba(text) to authenticated;
commit;

select
  to_regclass('public.arena_plaza_days') is not null as plaza_days_enabled,
  to_regprocedure('public.arena_plaza_record(jsonb)') is not null as plaza_record_enabled;
