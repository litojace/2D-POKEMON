-- Plaza lap quest (owner, 25 Nov 2026): "Run 3 laps in a row in 30 s" in
-- place of "Run a lap in under 30 s", for the same 20 coins. Players' best
-- laps run 4.8-7.8 s (arena_plaza_laps, 25 Nov), so one lap under 30 s was
-- done at a walk. The game server now sends `run` with a lap: the last 3
-- laps in a row, all told (ms), once there are 3 (PLAZA_LAP_RUN in
-- packages/shared/src/plaza.ts must match). A lap still sets the week's best
-- lap; only a run under 30 s sets the quest.
--
-- A game server still on the old code during the deploy sends no `run`: its
-- laps set best times but no quest until the new server is up (minutes).
-- Quests already done today stay done.
--
-- Safe to run again: create or replace with the same signature
-- (arena_plaza_record as in 20261123120000_plaza_gifts.sql, the lap branch
-- changed).
begin;

create or replace function public.arena_plaza_record(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; k text = p->>'kind'; v_ref text = p->>'ref'; d date = public.arena_today();
  ms integer; n integer; t public.arena_plaza_days; q record; have integer; inserted integer;
  first_coins integer; book_size integer; lap_run integer;
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
    -- A Rare or Legendary catch earns a gift box (at most 3 a day).
    if coalesce((p->>'gift')::boolean, false) then
      update public.arena_plaza_days set gifts = least(3, gifts + 1) where player_id = pid and day = d;
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
    -- The quest: 3 laps in a row under 30 s all told (PLAZA_LAP_RUN), as the
    -- game server timed them; one lap alone no longer counts. 3 s is less
    -- than any 3 real laps take (a best lap is 4.8 s and up).
    lap_run = (p->>'run')::integer;
    if lap_run is not null and lap_run >= 3000 and lap_run < 30000 then
      update public.arena_plaza_days set lap = 1 where player_id = pid and day = d;
    end if;
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
