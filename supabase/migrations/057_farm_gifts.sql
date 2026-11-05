-- Farm social, part 1: daily seed gifts, friendship levels and farm invites.
-- Run after 056_farm_exact_mutation_price.sql. Safe to run again.
--  * Once a Pacific day you can send each friend with a farm a seed parcel
--    (seeds they can plant at their level, picked on the server). They open
--    it within 7 days; you can open up to 20 parcels a day.
--  * A day on which a parcel between two friends is opened adds a friendship
--    day. Levels: Sprout (0), Bud (3), Bloom (7), Grove (30), Evergreen (90).
--  * Farm invites: a new player who opens your invite link (your friend code)
--    becomes your friend. An invite counts once they reach farm level 10;
--    then they get 200 Gold Leaves, and you collect rewards at 1, 3 and 5
--    invites (200 leaves; 300 leaves and a Gold Fertilizer; 1,000 leaves).
begin;

create table if not exists public.arena_farm_gifts (
  sender uuid not null references public.arena_profiles(id) on delete cascade,
  receiver uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  crop text not null references public.arena_farm_crops(id),
  qty integer not null check (qty between 1 and 5),
  opened_at timestamptz,
  primary key (sender, receiver, day),
  check (sender <> receiver)
);
create index if not exists arena_farm_gifts_receiver on public.arena_farm_gifts(receiver, opened_at);
-- One row per pair of friends (smaller id first).
create table if not exists public.arena_farm_bonds (
  a uuid not null references public.arena_profiles(id) on delete cascade,
  b uuid not null references public.arena_profiles(id) on delete cascade,
  days integer not null default 0 check (days >= 0),
  last_day date,
  primary key (a, b),
  check (a < b)
);
create table if not exists public.arena_farm_invites (
  invitee uuid primary key references public.arena_profiles(id) on delete cascade,
  inviter uuid not null references public.arena_profiles(id) on delete cascade,
  at timestamptz not null default now(),
  -- The invitee's own 200 leaves, paid once they reach farm level 10.
  welcomed boolean not null default false,
  check (invitee <> inviter)
);
create index if not exists arena_farm_invites_inviter on public.arena_farm_invites(inviter);
create table if not exists public.arena_farm_invite_rewards (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  step integer not null check (step in (1, 3, 5)),
  at timestamptz not null default now(),
  primary key (player_id, step)
);
alter table public.arena_farm_gifts enable row level security;
alter table public.arena_farm_bonds enable row level security;
alter table public.arena_farm_invites enable row level security;
alter table public.arena_farm_invite_rewards enable row level security;
revoke all on public.arena_farm_gifts, public.arena_farm_bonds, public.arena_farm_invites,
  public.arena_farm_invite_rewards from public, anon, authenticated, service_role;

-- Friendship level from friendship days: 0 Sprout … 4 Evergreen.
create or replace function public.arena_farm_bond_level(p_days integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_days >= 90 then 4 when p_days >= 30 then 3 when p_days >= 7 then 2
    when p_days >= 3 then 1 else 0 end
$$;

-- What a parcel holds: one crop the receiver can plant, picked from the day
-- and the pair (so a retry picks the same), 3 common / 2 uncommon / 1 rarer.
create or replace function public.arena_farm_gift_pick(p_sender uuid, p_receiver uuid, p_day date,
  out crop text, out qty integer)
language sql stable set search_path = public as $$
  select c.id, case c.rarity when 'common' then 3 when 'uncommon' then 2 else 1 end
  from public.arena_farm_crops c
  where c.level <= coalesce((select level from public.arena_farms where player_id = p_receiver), 1)
  order by md5('gift:' || p_sender::text || ':' || p_receiver::text || ':' || p_day::text || ':' || c.id)
  limit 1
$$;

-- Invites that count: the invitee reached farm level 10.
create or replace function public.arena_farm_invites_counted(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.arena_farm_invites i
  join public.arena_farms f on f.player_id = i.invitee
  join public.arena_profiles pr on pr.id = i.invitee and not pr.suspended
  where i.inviter = pid and f.level >= 10
$$;

-- Pay what is due: the invitee's welcome and the inviter's steps. Idempotent.
create or replace function public.arena_farm_invite_pay(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d date = public.arena_today(); n integer; s integer;
begin
  if exists (select 1 from public.arena_farm_invites i join public.arena_farms f on f.player_id = i.invitee
             where i.invitee = pid and not i.welcomed and f.level >= 10) then
    update public.arena_farm_invites set welcomed = true where invitee = pid;
    perform public.arena_grant_leaves(pid, 200, 'farm-invite-welcome', pid::text, d);
  end if;
  n = public.arena_farm_invites_counted(pid);
  foreach s in array array[1, 3, 5] loop
    if n >= s then
      insert into public.arena_farm_invite_rewards(player_id, step) values (pid, s) on conflict do nothing;
      if found then
        perform public.arena_grant_leaves(pid, case s when 1 then 200 when 3 then 300 else 1000 end,
          'farm-invite', s::text, d);
        if s = 3 then
          update public.arena_farms set fert_gold = fert_gold + 1 where player_id = pid;
        end if;
      end if;
    end if;
  end loop;
end; $$;

revoke all on function public.arena_farm_bond_level(integer),
  public.arena_farm_gift_pick(uuid, uuid, date), public.arena_farm_invites_counted(uuid),
  public.arena_farm_invite_pay(uuid) from public, anon, authenticated, service_role;

-- Friends, their gifts and bonds, and your invites, for the farm's Friends sheet.
create or replace function public.arena_farm_gifts_state(me uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'day', public.arena_today(),
    'openedToday', (select count(*) from public.arena_farm_gifts g
      where g.receiver = me and (g.opened_at at time zone 'America/Los_Angeles')::date = public.arena_today()),
    'openCap', 20,
    'friends', coalesce((select jsonb_agg(x order by lower(x->>'name')) from (
      select jsonb_build_object('id', pr.id, 'name', pr.display_name, 'fighter', pr.portrait_character,
        'level', f.level,
        'days', coalesce(bd.days, 0),
        'bond', public.arena_farm_bond_level(coalesce(bd.days, 0)),
        'sent', exists (select 1 from public.arena_farm_gifts g
          where g.sender = me and g.receiver = pr.id and g.day = public.arena_today()),
        'waiting', (select count(*) from public.arena_farm_gifts g
          where g.sender = pr.id and g.receiver = me and g.opened_at is null
            and g.day > public.arena_today() - 7)) x
      from public.arena_friendships fs
      join public.arena_profiles pr on pr.id = case when fs.a = me then fs.b else fs.a end
      join public.arena_farms f on f.player_id = pr.id
      left join public.arena_farm_bonds bd on bd.a = least(me, pr.id) and bd.b = greatest(me, pr.id)
      where (fs.a = me or fs.b = me) and not pr.suspended
      limit 100) y), '[]'::jsonb),
    'invites', jsonb_build_object(
      'code', public.arena_friend_code(me),
      'joined', (select count(*) from public.arena_farm_invites where inviter = me),
      'counted', public.arena_farm_invites_counted(me),
      'claimed', coalesce((select jsonb_agg(step order by step) from public.arena_farm_invite_rewards
        where player_id = me), '[]'::jsonb),
      'invitedBy', (select pr.display_name from public.arena_farm_invites i
        join public.arena_profiles pr on pr.id = i.inviter where i.invitee = me)))
$$;
revoke all on function public.arena_farm_gifts_state(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_gifts() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_invite_pay(me);
  return public.arena_farm_gifts_state(me);
end; $$;
revoke all on function public.arena_farm_gifts() from public, anon;
grant execute on function public.arena_farm_gifts() to authenticated;

-- Send today's parcel to a friend.
create or replace function public.arena_farm_gift_send(p_friend uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); pick record;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_friend is null or p_friend = me or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can trade gifts';
  end if;
  if not exists (select 1 from public.arena_farms where player_id = p_friend) then
    raise exception 'This friend has no farm yet';
  end if;
  perform public.arena_farm_ensure(me);
  select * into pick from public.arena_farm_gift_pick(me, p_friend, d);
  insert into public.arena_farm_gifts(sender, receiver, day, crop, qty)
  values (me, p_friend, d, pick.crop, pick.qty) on conflict do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'You already sent them a gift today',
      'state', public.arena_farm_gifts_state(me));
  end if;
  return jsonb_build_object('ok', true, 'state', public.arena_farm_gifts_state(me));
end; $$;
revoke all on function public.arena_farm_gift_send(uuid) from public, anon;
grant execute on function public.arena_farm_gift_send(uuid) to authenticated;

-- Open the oldest parcel a friend sent you (from the last 7 days).
create or replace function public.arena_farm_gift_open(p_friend uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); g public.arena_farm_gifts; lo uuid; hi uuid;
  opened integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_friend is null or p_friend = me then raise exception 'Unknown gift'; end if;
  perform public.arena_farm_ensure(me);
  perform 1 from public.arena_farms where player_id = me for update;
  select count(*) into opened from public.arena_farm_gifts x
   where x.receiver = me and (x.opened_at at time zone 'America/Los_Angeles')::date = d;
  if opened >= 20 then
    return jsonb_build_object('ok', false, 'error', 'You opened 20 gifts today. Open more tomorrow',
      'state', public.arena_farm_gifts_state(me));
  end if;
  select * into g from public.arena_farm_gifts x
   where x.sender = p_friend and x.receiver = me and x.opened_at is null and x.day > d - 7
   order by x.day limit 1 for update;
  if g.sender is null then
    return jsonb_build_object('ok', false, 'error', 'No gift to open', 'state', public.arena_farm_gifts_state(me));
  end if;
  update public.arena_farm_gifts set opened_at = now()
   where sender = g.sender and receiver = g.receiver and day = g.day;
  insert into public.arena_farm_seeds(player_id, crop, qty) values (me, g.crop, g.qty)
  on conflict (player_id, crop) do update set qty = public.arena_farm_seeds.qty + excluded.qty;
  -- One friendship day per Pacific day for the pair.
  lo = least(me, p_friend); hi = greatest(me, p_friend);
  insert into public.arena_farm_bonds(a, b) values (lo, hi) on conflict do nothing;
  update public.arena_farm_bonds set days = days + 1, last_day = d
   where a = lo and b = hi and (last_day is null or last_day < d);
  return jsonb_build_object('ok', true, 'crop', g.crop, 'qty', g.qty,
    'state', public.arena_farm_gifts_state(me));
end; $$;
revoke all on function public.arena_farm_gift_open(uuid) from public, anon;
grant execute on function public.arena_farm_gift_open(uuid) to authenticated;

-- A new player arrived through a farm invite link: remember who invited them
-- and make them friends. Only for accounts made in the last 7 days, once.
create or replace function public.arena_farm_invite_claim(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); inviter uuid; made timestamptz;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'That invite link is broken');
  end if;
  select id into inviter from public.arena_profiles
   where public.arena_friend_code(id) = upper(trim(p_code)) and not suspended limit 1;
  if inviter is null then return jsonb_build_object('ok', false, 'error', 'No player has that invite code'); end if;
  if inviter = me then return jsonb_build_object('ok', false, 'error', 'That is your own invite'); end if;
  if exists (select 1 from public.arena_farm_invites where invitee = me) then
    return jsonb_build_object('ok', false, 'error', 'You already joined through an invite');
  end if;
  select created_at into made from public.arena_profiles where id = me;
  if made < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'error', 'Invites are for new players');
  end if;
  insert into public.arena_farm_invites(invitee, inviter) values (me, inviter) on conflict do nothing;
  insert into public.arena_friendships(a, b) values (least(me, inviter), greatest(me, inviter)) on conflict do nothing;
  delete from public.arena_friend_requests
   where (from_id = me and to_id = inviter) or (from_id = inviter and to_id = me);
  return jsonb_build_object('ok', true, 'inviter', (select display_name from public.arena_profiles where id = inviter));
end; $$;
revoke all on function public.arena_farm_invite_claim(text) from public, anon;
grant execute on function public.arena_farm_invite_claim(text) to authenticated;

commit;
