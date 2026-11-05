-- Farm social, part 2: the Supply Balloon.
-- Run after 057_farm_gifts.sql. Safe to run again.
--  * A balloon waits by your farm with six crates, each asking for some of
--    one crop: five you can grow, one you can't yet (up to 20 levels ahead).
--  * Fill crates from your barn, or ask friends for up to 3 of them. An asked
--    crate shows on your friends' Help list; one friend fills it from their
--    barn and earns 1.2× its market value in Gold Leaves (up to 600 helper
--    leaves a Pacific day) and a Helper Star.
--  * Six full crates: launch it for 1.6× the crates' value in leaves, their
--    XP and a Gold Fertilizer. The next balloon floats in an hour later.
begin;

create table if not exists public.arena_farm_balloons (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  -- [{crop, qty, state: open|asked|done, by: helper id or null}], or null
  -- while the next balloon is on its way.
  crates jsonb,
  arrives_at timestamptz,
  launches integer not null default 0 check (launches >= 0)
);
create table if not exists public.arena_farm_helpers (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  stars integer not null default 0 check (stars >= 0)
);
create table if not exists public.arena_farm_help_days (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  leaves integer not null default 0 check (leaves >= 0),
  primary key (player_id, day)
);
-- Every crate filled, by whom and for whom (the Valley Cup counts these).
create table if not exists public.arena_farm_crate_log (
  id bigserial primary key,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  crop text not null,
  qty integer not null,
  at timestamptz not null default now()
);
create index if not exists arena_farm_crate_log_player on public.arena_farm_crate_log(player_id, at);
alter table public.arena_farm_balloons enable row level security;
alter table public.arena_farm_helpers enable row level security;
alter table public.arena_farm_help_days enable row level security;
alter table public.arena_farm_crate_log enable row level security;
revoke all on public.arena_farm_balloons, public.arena_farm_helpers, public.arena_farm_help_days,
  public.arena_farm_crate_log from public, anon, authenticated, service_role;
revoke all on sequence public.arena_farm_crate_log_id_seq from public, anon, authenticated, service_role;

-- How many of a crop a crate asks for: plenty of the cheap ones, a few rare.
create or replace function public.arena_farm_crate_qty(p_rarity text) returns integer
language sql volatile set search_path = '' as $$
  select case p_rarity when 'common' then 6 + floor(random() * 5)::integer
    when 'uncommon' then 3 + floor(random() * 4)::integer else 2 + floor(random() * 2)::integer end
$$;

-- A new balloon for a level: five crops you grow and one up to 20 levels ahead.
create or replace function public.arena_farm_balloon_new(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lvl integer = coalesce((select level from public.arena_farms where player_id = pid), 1);
  crates jsonb = '[]'::jsonb; c public.arena_farm_crops; used text[] = '{}';
begin
  for c in select * from public.arena_farm_crops where level <= lvl order by random() limit 5 loop
    used = used || c.id;
    crates = crates || jsonb_build_array(jsonb_build_object('crop', c.id,
      'qty', public.arena_farm_crate_qty(c.rarity), 'state', 'open', 'by', null));
  end loop;
  select * into c from public.arena_farm_crops
   where level > lvl and level <= lvl + 20 order by random() limit 1;
  if c.id is null then
    select * into c from public.arena_farm_crops where not id = any(used) order by random() limit 1;
  end if;
  crates = crates || jsonb_build_array(jsonb_build_object('crop', c.id,
    'qty', public.arena_farm_crate_qty(c.rarity), 'state', 'open', 'by', null));
  -- A low farm grows few kinds: repeat crops to make six crates.
  while jsonb_array_length(crates) < 6 loop
    crates = jsonb_build_array(crates->0) || crates;
  end loop;
  insert into public.arena_farm_balloons(player_id, crates, arrives_at) values (pid, crates, null)
  on conflict (player_id) do update set crates = excluded.crates, arrives_at = null;
end; $$;

-- A balloon is there unless one is on its way.
create or replace function public.arena_farm_balloon_refresh(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.arena_farm_balloons where player_id = pid)
     or exists (select 1 from public.arena_farm_balloons where player_id = pid
       and crates is null and arrives_at <= now()) then
    perform public.arena_farm_balloon_new(pid);
  end if;
end; $$;

-- A crate's market value: the crop's base sell price × how many.
create or replace function public.arena_farm_crate_value(p_crate jsonb) returns integer
language sql stable set search_path = public as $$
  select coalesce((select c.sell from public.arena_farm_crops c where c.id = p_crate->>'crop'), 0)
    * (p_crate->>'qty')::integer
$$;

create or replace function public.arena_farm_balloon_view(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'crates', b.crates,
    'arrivesAt', b.arrives_at,
    'launches', b.launches,
    'leaves', case when b.crates is not null then (round((select sum(public.arena_farm_crate_value(x))
      from jsonb_array_elements(b.crates) x) * 1.6 / 5) * 5)::integer end,
    'xp', case when b.crates is not null then (select sum(c.xp * (x->>'qty')::integer)
      from jsonb_array_elements(b.crates) x join public.arena_farm_crops c on c.id = x->>'crop') end,
    'helperStars', coalesce((select stars from public.arena_farm_helpers where player_id = pid), 0),
    'helperLeavesToday', coalesce((select leaves from public.arena_farm_help_days
      where player_id = pid and day = public.arena_today()), 0),
    'helperCap', 600,
    'helpers', coalesce((select jsonb_object_agg(pr.id, pr.display_name) from public.arena_profiles pr
      where pr.id in (select (x->>'by')::uuid from jsonb_array_elements(b.crates) x where x->>'by' is not null)),
      '{}'::jsonb))
  from public.arena_farm_balloons b where b.player_id = pid
$$;
revoke all on function public.arena_farm_crate_qty(text), public.arena_farm_balloon_new(uuid),
  public.arena_farm_balloon_refresh(uuid), public.arena_farm_crate_value(jsonb),
  public.arena_farm_balloon_view(uuid) from public, anon, authenticated, service_role;

-- Take crops out of a barn: plain first, then the cheapest mutations. False
-- (and nothing taken) when there aren't enough.
create or replace function public.arena_farm_take(pid uuid, p_crop text, p_qty integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare need integer = p_qty; take integer; b record;
begin
  if coalesce((select sum(qty) from public.arena_farm_barn where player_id = pid and crop = p_crop), 0) < p_qty then
    return false;
  end if;
  for b in select mutation, qty from public.arena_farm_barn
      where player_id = pid and crop = p_crop and qty > 0
      order by public.arena_farm_mutation_mult(mutation), mutation loop
    exit when need = 0;
    take = least(need, b.qty);
    update public.arena_farm_barn set qty = qty - take
     where player_id = pid and crop = p_crop and mutation = b.mutation;
    need = need - take;
  end loop;
  return true;
end; $$;
revoke all on function public.arena_farm_take(uuid, text, integer) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_balloon() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  perform public.arena_farm_balloon_refresh(me);
  return public.arena_farm_balloon_view(me);
end; $$;
revoke all on function public.arena_farm_balloon() from public, anon;
grant execute on function public.arena_farm_balloon() to authenticated;

-- Fill a crate from your barn, ask friends for one, or launch a full balloon.
create or replace function public.arena_farm_balloon_act(p_request uuid, p_kind text, p_slot integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); b public.arena_farm_balloons; crate jsonb;
  inserted integer; err text; gained jsonb; v_leaves integer; v_xp integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or p_kind not in ('fill', 'ask', 'launch')
     or (p_kind <> 'launch' and (p_slot is null or p_slot not between 0 and 5)) then
    raise exception 'Invalid balloon request';
  end if;
  perform public.arena_farm_ensure(me);
  perform 1 from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('balloon', public.arena_farm_balloon_view(me), 'ok', false, 'repeated', true);
  end if;
  perform public.arena_farm_balloon_refresh(me);
  select * into b from public.arena_farm_balloons where player_id = me for update;
  if b.crates is null then err = 'The next balloon is on its way';
  elsif p_kind = 'launch' then
    if exists (select 1 from jsonb_array_elements(b.crates) x where x->>'state' <> 'done') then
      err = 'Fill all six crates first';
    else
      v_leaves = (round((select sum(public.arena_farm_crate_value(x)) from jsonb_array_elements(b.crates) x)
        * 1.6 / 5) * 5)::integer;
      select sum(c.xp * (x->>'qty')::integer) into v_xp
        from jsonb_array_elements(b.crates) x join public.arena_farm_crops c on c.id = x->>'crop';
      perform public.arena_grant_leaves(me, v_leaves, 'farm-balloon', p_request::text, d);
      perform public.arena_farm_add_xp(me, v_xp);
      update public.arena_farms set fert_gold = fert_gold + 1 where player_id = me;
      update public.arena_farm_balloons set crates = null, arrives_at = now() + interval '1 hour',
        launches = launches + 1 where player_id = me;
      gained = jsonb_build_object('leaves', v_leaves, 'xp', v_xp, 'bonus', 'gold');
    end if;
  else
    crate = b.crates->p_slot;
    if crate->>'state' = 'done' then err = 'This crate is full';
    elsif p_kind = 'ask' then
      if crate->>'state' = 'asked' then err = 'Your friends already see this crate';
      elsif (select count(*) from jsonb_array_elements(b.crates) x where x->>'state' = 'asked'
               or (x->>'by') is not null) >= 3 then
        err = 'You can ask friends for 3 crates a balloon';
      else
        update public.arena_farm_balloons set crates = jsonb_set(crates, array[p_slot::text, 'state'], '"asked"')
         where player_id = me;
      end if;
    elsif not public.arena_farm_take(me, crate->>'crop', (crate->>'qty')::integer) then
      err = 'You need ' || (crate->>'qty') || ' ' || (select name from public.arena_farm_crops where id = crate->>'crop');
    else
      update public.arena_farm_balloons set crates = jsonb_set(crates, array[p_slot::text, 'state'], '"done"')
       where player_id = me;
      insert into public.arena_farm_crate_log(player_id, owner, crop, qty)
      values (me, me, crate->>'crop', (crate->>'qty')::integer);
    end if;
  end if;
  return jsonb_build_object('balloon', public.arena_farm_balloon_view(me), 'ok', err is null, 'error', err,
    'gained', gained);
end; $$;
revoke all on function public.arena_farm_balloon_act(uuid, text, integer) from public, anon;
grant execute on function public.arena_farm_balloon_act(uuid, text, integer) to authenticated;

-- Your friends' asked crates, with how many of each crop you have.
create or replace function public.arena_farm_help_list_for(me uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'friend', pr.id, 'name', pr.display_name, 'fighter', pr.portrait_character,
      'slot', x.k - 1, 'crop', x.v->>'crop', 'qty', (x.v->>'qty')::integer,
      'reward', ceil(public.arena_farm_crate_value(x.v) * 1.2)::integer,
      'have', coalesce((select sum(qty) from public.arena_farm_barn bn
        where bn.player_id = me and bn.crop = x.v->>'crop'), 0))
    order by lower(pr.display_name), x.k), '[]'::jsonb)
  from public.arena_friendships fs
  join public.arena_profiles pr on pr.id = case when fs.a = me then fs.b else fs.a end and not pr.suspended
  join public.arena_farm_balloons b on b.player_id = pr.id and b.crates is not null
  cross join lateral jsonb_array_elements(b.crates) with ordinality x(v, k)
  where (fs.a = me or fs.b = me) and x.v->>'state' = 'asked'
$$;
revoke all on function public.arena_farm_help_list_for(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_help_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return jsonb_build_object('requests', public.arena_farm_help_list_for(me),
    'helperStars', coalesce((select stars from public.arena_farm_helpers where player_id = me), 0),
    'helperLeavesToday', coalesce((select leaves from public.arena_farm_help_days
      where player_id = me and day = public.arena_today()), 0),
    'helperCap', 600);
end; $$;
revoke all on function public.arena_farm_help_list() from public, anon;
grant execute on function public.arena_farm_help_list() to authenticated;

-- Fill a friend's asked crate from your barn.
create or replace function public.arena_farm_help_fill(p_request uuid, p_friend uuid, p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); b public.arena_farm_balloons; crate jsonb;
  inserted integer; err text; v_value integer; v_paid integer = 0; v_today integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or p_slot is null or p_slot not between 0 and 5 then
    raise exception 'Invalid help request';
  end if;
  if p_friend is null or p_friend = me or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can help';
  end if;
  perform public.arena_farm_ensure(me);
  -- Both farms, always locked in the same order.
  perform 1 from public.arena_farms where player_id in (me, p_friend) order by player_id for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('help', public.arena_farm_help_list_for(me), 'ok', false, 'repeated', true);
  end if;
  select * into b from public.arena_farm_balloons where player_id = p_friend for update;
  crate = b.crates->p_slot;
  if b.crates is null or crate is null or crate->>'state' <> 'asked' then
    err = 'Someone already filled that crate';
  elsif not public.arena_farm_take(me, crate->>'crop', (crate->>'qty')::integer) then
    err = 'You need ' || (crate->>'qty') || ' ' || (select name from public.arena_farm_crops where id = crate->>'crop');
  else
    update public.arena_farm_balloons
       set crates = jsonb_set(jsonb_set(crates, array[p_slot::text, 'state'], '"done"'),
         array[p_slot::text, 'by'], to_jsonb(me::text))
     where player_id = p_friend;
    insert into public.arena_farm_crate_log(player_id, owner, crop, qty)
    values (me, p_friend, crate->>'crop', (crate->>'qty')::integer);
    insert into public.arena_farm_helpers(player_id, stars) values (me, 1)
    on conflict (player_id) do update set stars = public.arena_farm_helpers.stars + 1;
    insert into public.arena_farm_help_days(player_id, day) values (me, d) on conflict do nothing;
    select leaves into v_today from public.arena_farm_help_days where player_id = me and day = d for update;
    v_value = ceil(public.arena_farm_crate_value(crate) * 1.2)::integer;
    v_paid = greatest(0, least(v_value, 600 - v_today));
    if v_paid > 0 then
      perform public.arena_grant_leaves(me, v_paid, 'farm-help', p_request::text, d);
      update public.arena_farm_help_days set leaves = leaves + v_paid where player_id = me and day = d;
    end if;
  end if;
  return jsonb_build_object('help', public.arena_farm_help_list_for(me), 'ok', err is null, 'error', err,
    'gained', case when err is null then jsonb_build_object('leaves', v_paid, 'star', 1) end);
end; $$;
revoke all on function public.arena_farm_help_fill(uuid, uuid, integer) from public, anon;
grant execute on function public.arena_farm_help_fill(uuid, uuid, integer) to authenticated;

commit;
