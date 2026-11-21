-- Fishing at the Plaza's pond (packages/shared/src/plaza.ts: PLAZA_FISHING,
-- PLAZA_FISH, the "fish" quest in PLAZA_QUESTS; checked by
-- tests/integration/plaza-fishing.test.ts and plaza-rewards.test.ts).
--  * The game server decides the bite and the fish and reports each catch:
--    arena_plaza_record({player, kind: 'fish', ref: <fish id>}).
--  * At most 30 catches count a Pacific day (PLAZA_FISHING.perDay), like the
--    orbs' cap: they fill the new daily quest "Catch 10 fish" (25 coins) and
--    the Fish book's counts. A fish never caught before still enters the
--    book past the cap, with nothing counted.
--  * The Fish book: every fish a player has caught, with how many counted
--    (arena_plaza_state's 'fishBook'), and today's counted catches
--    ('fishToday').
--  * First catches: the first time a player catches each fish pays shop
--    coins by its rarity (PLAZA_FISH_RARITY.firstCoins, sent by the game
--    server as 'coins', at most 50), once per player and fish (coin ledger
--    reason 'plaza-fish-first', ref = the fish id).
--  * Catching every fish in the book (the game server sends 'bookSize', the
--    shared list's length) earns the title "Master Angler"
--    (PLAZA_FISH_TITLE); arena_plaza_state's 'fishTitle' says if you have it.
-- The fish list itself lives in the shared code; the database checks only the
-- shape of an id, so new fish need no migration.
-- Safe to run again: add column / create table if not exists, and create or
-- replace with the signatures the functions already have. Quests already paid
-- today stay paid (arena_plaza_days.paid).
begin;

alter table public.arena_plaza_days add column if not exists fish integer not null default 0;

create table if not exists public.arena_plaza_fish_book (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  fish text not null check (fish ~ '^[a-z][a-z0-9-]{1,31}$'),
  caught integer not null default 0,
  first_day date not null,
  primary key (player_id, fish)
);
alter table public.arena_plaza_fish_book enable row level security;
revoke all on public.arena_plaza_fish_book from public, anon, authenticated;

-- The Fish book's title (the same words as PLAZA_FISH_TITLE). An admin's
-- later edit of it is kept.
insert into public.arena_titles(name, description, color, active)
select 'Master Angler', 'Catch every fish in the Plaza pond''s Fish book.', '#5fb3ff', true
where not exists (select 1 from public.arena_titles where name = 'Master Angler');

-- The quests, with "Catch 10 fish" last (the order of PLAZA_QUESTS).
create or replace function public.arena_plaza_quests() returns table(id text, needed integer, coins integer)
language sql immutable set search_path = public as $$
  values ('goal', 1, 20), ('lap', 1, 20), ('cheers', 15, 15), ('orbs', 10, 15), ('photo', 1, 10), ('fish', 10, 25)
$$;
revoke all on function public.arena_plaza_quests() from public, anon, authenticated, service_role;

create or replace function public.arena_plaza_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date = public.arena_today(); w date = public.arena_plaza_week(public.arena_today()); t public.arena_plaza_days;
begin
  select * into t from public.arena_plaza_days where player_id = pid and day = d;
  return jsonb_build_object(
    'day', d,
    'quests', (select jsonb_object_agg(q.id, jsonb_build_object(
        'n', least(q.needed, case q.id when 'goal' then coalesce(t.goal, 0) when 'lap' then coalesce(t.lap, 0)
          when 'cheers' then coalesce(t.cheers, 0) when 'orbs' then coalesce(t.orbs, 0)
          when 'fish' then coalesce(t.fish, 0) else coalesce(t.photo, 0) end),
        'done', q.id = any(coalesce(t.paid, '{}'))))
      from public.arena_plaza_quests() q),
    'orbsToday', (select count(*) from public.arena_plaza_orbs o where o.player_id = pid and o.day = d),
    'fishToday', coalesce(t.fish, 0),
    'fishBook', coalesce((select jsonb_object_agg(b.fish, b.caught) from public.arena_plaza_fish_book b
      where b.player_id = pid), '{}'::jsonb),
    'fishTitle', exists (select 1 from public.arena_player_titles pt
      join public.arena_titles ti on ti.id = pt.title_id where pt.player_id = pid and ti.name = 'Master Angler'),
    'bestLapMs', (select best_ms from public.arena_plaza_laps where player_id = pid and week = w),
    'board', coalesce((select jsonb_agg(jsonb_build_object('name', b.display_name, 'ms', b.best_ms, 'me', b.player_id = pid) order by b.best_ms, b.set_at)
      from (select l.player_id, l.best_ms, l.set_at, p.display_name from public.arena_plaza_laps l
        join public.arena_profiles p on p.id = l.player_id and not p.suspended
        where l.week = w order by l.best_ms, l.set_at limit 5) b), '[]'::jsonb));
end; $$;
revoke all on function public.arena_plaza_state(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_plaza_record(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; k text = p->>'kind'; v_ref text = p->>'ref'; d date = public.arena_today();
  ms integer; n integer; t public.arena_plaza_days; q record; have integer; inserted integer;
  first_coins integer; book_size integer;
begin
  begin pid = (p->>'player')::uuid; exception when others then raise exception 'Bad player'; end;
  if pid is null or not exists (select 1 from public.arena_profiles where id = pid and not suspended) then
    return null;
  end if;
  insert into public.arena_plaza_days(player_id, day) values (pid, d) on conflict do nothing;
  -- One Plaza record at a time per player, so the caps hold.
  select * into t from public.arena_plaza_days where player_id = pid and day = d for update;
  if k = 'orb' then
    -- ref: "<shower start, in UTC minutes>-<orb id>". At most 50 a day and
    -- 10 a shower count; each orb once.
    if v_ref is null or v_ref !~ '^[0-9]{6,12}-[0-9]{1,9}$' then raise exception 'Bad orb'; end if;
    if (select count(*) from public.arena_plaza_orbs o where o.player_id = pid and o.day = d) < 50
       and (select count(*) from public.arena_plaza_orbs o
         where o.player_id = pid and o.ref like split_part(v_ref, '-', 1) || '-%') < 10 then
      insert into public.arena_plaza_orbs(player_id, ref, day) values (pid, v_ref, d) on conflict do nothing;
      get diagnostics inserted = row_count;
      if inserted > 0 then
        update public.arena_plaza_days set orbs = orbs + 1 where player_id = pid and day = d;
      end if;
    end if;
  elsif k = 'fish' then
    -- ref: the fish's id (PLAZA_FISH). At most 30 catches count a day.
    if v_ref is null or v_ref !~ '^[a-z][a-z0-9-]{1,31}$' then raise exception 'Bad fish'; end if;
    if t.fish < 30 then
      update public.arena_plaza_days set fish = fish + 1 where player_id = pid and day = d;
      insert into public.arena_plaza_fish_book(player_id, fish, caught, first_day) values (pid, v_ref, 1, d)
      on conflict (player_id, fish) do update set caught = public.arena_plaza_fish_book.caught + 1;
    else
      insert into public.arena_plaza_fish_book(player_id, fish, caught, first_day) values (pid, v_ref, 0, d)
      on conflict do nothing;
    end if;
    -- A first catch of this fish pays once (the ledger is unique per ref).
    first_coins = least(50, greatest(0, coalesce((p->>'coins')::integer, 0)));
    if first_coins > 0 then
      perform public.arena_grant(pid, first_coins, 'plaza-fish-first', v_ref, d);
    end if;
    -- Every fish in the book: the title (a book of at least 8, so a bad
    -- size can't hand it out).
    book_size = coalesce((p->>'bookSize')::integer, 0);
    if book_size >= 8
       and (select count(*) from public.arena_plaza_fish_book b where b.player_id = pid) >= book_size then
      insert into public.arena_player_titles(player_id, title_id)
      select pid, ti.id from public.arena_titles ti where ti.name = 'Master Angler' on conflict do nothing;
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
  -- A quest done today pays its coins once.
  select * into t from public.arena_plaza_days where player_id = pid and day = d;
  for q in select * from public.arena_plaza_quests() loop
    have = case q.id when 'goal' then t.goal when 'lap' then t.lap when 'cheers' then t.cheers
      when 'orbs' then t.orbs when 'fish' then t.fish else t.photo end;
    if have >= q.needed and not (q.id = any(t.paid)) then
      update public.arena_plaza_days set paid = paid || q.id where player_id = pid and day = d;
      perform public.arena_grant(pid, q.coins, 'plaza-quest', d::text || ':' || q.id, d);
    end if;
  end loop;
  return public.arena_plaza_state(pid);
end; $$;
revoke all on function public.arena_plaza_record(jsonb) from public, anon, authenticated;
grant execute on function public.arena_plaza_record(jsonb) to service_role;

commit;
