-- Farm social, part 4: co-ops and the weekly Valley Cup.
-- Run after 059_farm_stall.sql. Safe to run again.
--  * A co-op has up to 10 farmers. Make one (it gets a 6-letter code) or
--    join one with its code; leave any time.
--  * Each week (Monday to Sunday, Pacific) a member takes Cup tasks one at a
--    time, up to 9 a week. A task counts what you do after taking it
--    (harvests, orders, balloon crates, stall sales, gifts, crates for
--    friends); finished, its points go to your co-op.
--  * Co-op points reach tiers: 2,000 (3 Super Fertilizer), 4,000 (rare
--    seeds) and 6,000 (500 Gold Leaves). Every member who finished a task
--    that week can claim each tier reached, once.
--  * Every co-op is ranked by its points this week.
begin;

create table if not exists public.arena_farm_coops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  created_by uuid references public.arena_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.arena_farm_coop_members (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  coop_id uuid not null references public.arena_farm_coops(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists arena_farm_coop_members_coop on public.arena_farm_coop_members(coop_id);
create table if not exists public.arena_farm_cup_tasks (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  n smallint not null check (n between 1 and 9),
  coop_id uuid references public.arena_farm_coops(id) on delete set null,
  task text not null,
  base integer not null,
  goal integer not null,
  pts integer not null,
  taken_at timestamptz not null default now(),
  done_at timestamptz,
  dropped boolean not null default false,
  primary key (player_id, week, n)
);
create index if not exists arena_farm_cup_tasks_coop on public.arena_farm_cup_tasks(coop_id, week);
create table if not exists public.arena_farm_cup_rewards (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  tier smallint not null check (tier between 1 and 3),
  primary key (player_id, week, tier)
);
alter table public.arena_farm_coops enable row level security;
alter table public.arena_farm_coop_members enable row level security;
alter table public.arena_farm_cup_tasks enable row level security;
alter table public.arena_farm_cup_rewards enable row level security;
revoke all on public.arena_farm_coops, public.arena_farm_coop_members, public.arena_farm_cup_tasks,
  public.arena_farm_cup_rewards from public, anon, authenticated, service_role;

-- The tasks: id → what it counts, how many, the points.
create or replace function public.arena_farm_cup_catalog() returns table(id text, goal integer, pts integer)
language sql immutable set search_path = '' as $$
  values ('harvest', 30, 320), ('orders', 2, 300), ('crates', 3, 260), ('sell', 2, 280),
    ('gifts', 3, 150), ('help', 1, 220)
$$;

-- A player's running count for a task (what the task measures from its base).
create or replace function public.arena_farm_cup_counter(pid uuid, p_task text) returns integer
language sql stable security definer set search_path = public as $$
  select (case p_task
    when 'harvest' then (select coalesce(sum(harvests), 0) from public.arena_farm_harvests where player_id = pid)
    when 'orders' then (select count(*) from public.arena_leaf_ledger where player_id = pid and reason = 'farm-order')
    when 'crates' then (select count(*) from public.arena_farm_crate_log where player_id = pid)
    when 'sell' then (select count(*) from public.arena_farm_stall_sales where seller = pid)
    when 'gifts' then (select count(*) from public.arena_farm_gifts where sender = pid)
    when 'help' then (select count(*) from public.arena_farm_crate_log where player_id = pid and owner <> pid)
    else 0 end)::integer
$$;

create or replace function public.arena_farm_cup_week() returns date
language sql stable set search_path = public as $$
  select public.arena_plaza_week(public.arena_today())
$$;

-- Finish the active task if its count is reached (points go to the co-op).
create or replace function public.arena_farm_cup_settle(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.arena_farm_cup_tasks; w date = public.arena_farm_cup_week();
begin
  select * into t from public.arena_farm_cup_tasks
   where player_id = pid and week = w and done_at is null and not dropped for update;
  if t.player_id is not null
     and public.arena_farm_cup_counter(pid, t.task) - t.base >= t.goal then
    update public.arena_farm_cup_tasks set done_at = now(),
      coop_id = (select coop_id from public.arena_farm_coop_members where player_id = pid)
     where player_id = pid and week = w and n = t.n;
  end if;
end; $$;

create or replace function public.arena_farm_coop_points(p_coop uuid, p_week date) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(pts), 0)::integer from public.arena_farm_cup_tasks
  where coop_id = p_coop and week = p_week and done_at is not null
$$;

create or replace function public.arena_farm_cup_state(me uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with w as (select public.arena_farm_cup_week() wk),
  my as (select m.coop_id from public.arena_farm_coop_members m where m.player_id = me),
  pts as (select public.arena_farm_coop_points((select coop_id from my), (select wk from w)) p),
  ranked as (
    select c.id, c.name, public.arena_farm_coop_points(c.id, (select wk from w)) p
    from public.arena_farm_coops c
    where exists (select 1 from public.arena_farm_coop_members m where m.coop_id = c.id)),
  ordered as (select r.*, rank() over (order by r.p desc, r.name) rk from ranked r),
  act as (select * from public.arena_farm_cup_tasks t
    where t.player_id = me and t.week = (select wk from w) and t.done_at is null and not t.dropped)
  select jsonb_build_object(
    'week', (select wk from w),
    'endsAt', (((select wk from w) + 7)::timestamp at time zone 'America/Los_Angeles'),
    'coop', (select jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code,
        'members', (select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.display_name,
            'fighter', pr.portrait_character,
            'pts', (select coalesce(sum(t.pts), 0) from public.arena_farm_cup_tasks t
              where t.player_id = pr.id and t.coop_id = c.id and t.week = (select wk from w)
                and t.done_at is not null)) order by lower(pr.display_name))
          from public.arena_farm_coop_members m join public.arena_profiles pr on pr.id = m.player_id
          where m.coop_id = c.id))
      from public.arena_farm_coops c where c.id = (select coop_id from my)),
    'pts', (select p from pts),
    'tiers', (select jsonb_agg(jsonb_build_object('tier', k, 'pts', k * 2000,
        'reward', (array['3 Super Fertilizer', 'Rare seeds', '500 Gold Leaves'])[k],
        'reached', (select p from pts) >= k * 2000,
        'claimed', exists (select 1 from public.arena_farm_cup_rewards r
          where r.player_id = me and r.week = (select wk from w) and r.tier = k)) order by k)
      from generate_series(1, 3) k),
    'tasks', (select jsonb_agg(jsonb_build_object('id', c.id, 'goal', c.goal, 'pts', c.pts) order by c.pts desc)
      from public.arena_farm_cup_catalog() c),
    'active', (select jsonb_build_object('task', a.task, 'goal', a.goal, 'pts', a.pts,
        'progress', least(a.goal, public.arena_farm_cup_counter(me, a.task) - a.base)) from act a),
    'done', (select count(*) from public.arena_farm_cup_tasks t
      where t.player_id = me and t.week = (select wk from w) and t.done_at is not null),
    'taken', (select count(*) from public.arena_farm_cup_tasks t
      where t.player_id = me and t.week = (select wk from w)),
    'rank', (select o.rk from ordered o where o.id = (select coop_id from my)),
    'coops', (select count(*) from ordered),
    'ranking', coalesce((select jsonb_agg(jsonb_build_object('rank', o.rk, 'name', o.name, 'pts', o.p,
        'me', o.id = (select coop_id from my)) order by o.rk, o.name)
      from ordered o where o.rk <= 10 or o.id = (select coop_id from my)), '[]'::jsonb))
$$;
revoke all on function public.arena_farm_cup_catalog(), public.arena_farm_cup_week(),
  public.arena_farm_cup_counter(uuid, text), public.arena_farm_cup_settle(uuid),
  public.arena_farm_coop_points(uuid, date), public.arena_farm_cup_state(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.arena_farm_cup() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  perform public.arena_farm_cup_settle(me);
  return public.arena_farm_cup_state(me);
end; $$;
revoke all on function public.arena_farm_cup() from public, anon;
grant execute on function public.arena_farm_cup() to authenticated;

-- Make, join or leave a co-op; take or drop a task; claim a tier.
create or replace function public.arena_farm_cup_act(p_request uuid, p_kind text, p_arg text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); w date = public.arena_farm_cup_week();
  inserted integer; err text; gained jsonb; v_coop uuid; v_code text; cat record; v_n integer;
  v_tier integer; v_crop text; v_name text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or p_kind not in ('create', 'join', 'leave', 'take', 'drop', 'claim') then
    raise exception 'Invalid Cup request';
  end if;
  perform public.arena_farm_ensure(me);
  perform 1 from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('cup', public.arena_farm_cup_state(me), 'ok', false, 'repeated', true);
  end if;
  perform public.arena_farm_cup_settle(me);
  select coop_id into v_coop from public.arena_farm_coop_members where player_id = me;
  if p_kind = 'create' then
    v_name = btrim(regexp_replace(coalesce(p_arg, ''), '\s+', ' ', 'g'));
    if v_coop is not null then err = 'Leave your co-op first';
    elsif char_length(v_name) not between 3 and 24 or v_name !~ '^[[:alnum:] ''.!-]+$' then
      err = 'Name it with 3 to 24 letters or numbers';
    else
      loop
        v_code = (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '')
          from generate_series(1, 6));
        exit when not exists (select 1 from public.arena_farm_coops where code = v_code);
      end loop;
      insert into public.arena_farm_coops(name, code, created_by) values (v_name, v_code, me) returning id into v_coop;
      insert into public.arena_farm_coop_members(player_id, coop_id) values (me, v_coop);
    end if;
  elsif p_kind = 'join' then
    select id into v_code from public.arena_farm_coops where code = upper(btrim(coalesce(p_arg, '')));
    if v_coop is not null then err = 'Leave your co-op first';
    elsif v_code is null then err = 'No co-op has that code';
    else
      perform 1 from public.arena_farm_coops where id = v_code::uuid for update;
      if (select count(*) from public.arena_farm_coop_members where coop_id = v_code::uuid) >= 10 then
        err = 'That co-op is full (10 farmers)';
      else
        insert into public.arena_farm_coop_members(player_id, coop_id) values (me, v_code::uuid);
      end if;
    end if;
  elsif p_kind = 'leave' then
    if v_coop is null then err = 'You are not in a co-op';
    else
      delete from public.arena_farm_coop_members where player_id = me;
      -- An unfinished task stays yours; finished points stay with the co-op.
    end if;
  elsif p_kind = 'take' then
    select * into cat from public.arena_farm_cup_catalog() c where c.id = p_arg;
    v_n = (select count(*) from public.arena_farm_cup_tasks where player_id = me and week = w);
    if v_coop is null then err = 'Join a co-op to take Cup tasks';
    elsif cat.id is null then err = 'Unknown task';
    elsif exists (select 1 from public.arena_farm_cup_tasks where player_id = me and week = w
        and done_at is null and not dropped) then err = 'Finish or drop your task first';
    elsif v_n >= 9 then err = 'You took 9 tasks this week';
    else
      insert into public.arena_farm_cup_tasks(player_id, week, n, coop_id, task, base, goal, pts)
      values (me, w, v_n + 1, v_coop, cat.id, public.arena_farm_cup_counter(me, cat.id), cat.goal, cat.pts);
    end if;
  elsif p_kind = 'drop' then
    update public.arena_farm_cup_tasks set dropped = true
     where player_id = me and week = w and done_at is null and not dropped;
    if not found then err = 'You have no task to drop'; end if;
  else
    v_tier = case when p_arg ~ '^[123]$' then p_arg::integer end;
    if v_tier is null then err = 'Unknown tier';
    elsif v_coop is null then err = 'Join a co-op first';
    elsif public.arena_farm_coop_points(v_coop, w) < v_tier * 2000 then err = 'Your co-op hasn''t reached that yet';
    elsif not exists (select 1 from public.arena_farm_cup_tasks where player_id = me and week = w
        and done_at is not null) then err = 'Finish a task this week to share the rewards';
    else
      insert into public.arena_farm_cup_rewards(player_id, week, tier) values (me, w, v_tier) on conflict do nothing;
      if not found then err = 'Already claimed';
      elsif v_tier = 1 then
        update public.arena_farms set fert_super = fert_super + 3 where player_id = me;
        gained = jsonb_build_object('fertilizer', 'super', 'qty', 3);
      elsif v_tier = 2 then
        select id into v_crop from public.arena_farm_crops
         where level <= (select level from public.arena_farms where player_id = me)
         order by level desc, id limit 1;
        insert into public.arena_farm_seeds(player_id, crop, qty) values (me, v_crop, 5)
        on conflict (player_id, crop) do update set qty = public.arena_farm_seeds.qty + 5;
        gained = jsonb_build_object('seeds', v_crop, 'qty', 5);
      else
        perform public.arena_grant_leaves(me, 500, 'farm-cup', w::text || ':3', d);
        gained = jsonb_build_object('leaves', 500);
      end if;
    end if;
  end if;
  perform public.arena_farm_cup_settle(me);
  return jsonb_build_object('cup', public.arena_farm_cup_state(me), 'ok', err is null, 'error', err, 'gained', gained);
end; $$;
revoke all on function public.arena_farm_cup_act(uuid, text, text) from public, anon;
grant execute on function public.arena_farm_cup_act(uuid, text, text) to authenticated;

commit;
