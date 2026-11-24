-- Farm social, part 5: live visits, Harvest Parties and farm likes.
-- Run after 060_farm_cup.sql. Safe to run again.
--  * While a farm is open, the game says so every ~15 seconds
--    (arena_farm_here): on your own farm, or on a friend's. Everyone on the
--    same farm sees who is there and their emotes.
--  * Harvest Party: while you are on your farm and a friend is there with
--    you, each harvest gives one more crop. A farm gets up to 60 party
--    minutes a Pacific day.
--  * Like a friend's farm once a week; friends' farms are ranked by this
--    week's likes (the Farm Tour).
begin;

create table if not exists public.arena_farm_presence (
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  visitor uuid not null references public.arena_profiles(id) on delete cascade,
  until timestamptz not null,
  emote text check (emote is null or char_length(emote) <= 8),
  emote_at timestamptz,
  primary key (owner, visitor)
);
create table if not exists public.arena_farm_party_days (
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds >= 0),
  last_at timestamptz,
  primary key (owner, day)
);
create table if not exists public.arena_farm_likes (
  liker uuid not null references public.arena_profiles(id) on delete cascade,
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  at timestamptz not null default now(),
  primary key (liker, owner, week),
  check (liker <> owner)
);
create index if not exists arena_farm_likes_owner on public.arena_farm_likes(owner, week);
alter table public.arena_farm_presence enable row level security;
alter table public.arena_farm_party_days enable row level security;
alter table public.arena_farm_likes enable row level security;
revoke all on public.arena_farm_presence, public.arena_farm_party_days, public.arena_farm_likes
  from public, anon, authenticated, service_role;

-- A party is on: the owner and at least one friend are on the owner's farm,
-- and the farm has party minutes left today.
create or replace function public.arena_farm_party(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.arena_farm_presence where owner = pid and visitor = pid and until > now())
    and exists (select 1 from public.arena_farm_presence where owner = pid and visitor <> pid and until > now())
    and coalesce((select seconds from public.arena_farm_party_days
      where owner = pid and day = public.arena_today()), 0) < 3600
$$;

-- As in 055_new_champion_farm_perks.sql, plus one crop during a party.
create or replace function public.arena_farm_yield(pid uuid, p_idx integer) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(1, (case when public.arena_farm_perk_of((select farmer from public.arena_farms where player_id = pid)) = 'terradon'
    then 3 else 2 end) - coalesce((select stolen from public.arena_farm_plots where player_id = pid and idx = p_idx), 0))
    + case when public.arena_farm_party(pid) then 1 else 0 end
$$;
revoke all on function public.arena_farm_party(uuid), public.arena_farm_yield(uuid, integer)
  from public, anon, authenticated, service_role;

-- Who is on a farm right now (as `me` sees it).
create or replace function public.arena_farm_here_view(me uuid, p_owner uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owner', p_owner,
    'present', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.display_name,
        'fighter', pr.portrait_character, 'owner', h.visitor = p_owner,
        'emote', case when h.emote_at > now() - interval '20 seconds' then h.emote end,
        'emoteAt', h.emote_at) order by h.visitor = p_owner desc, lower(pr.display_name))
      from public.arena_farm_presence h join public.arena_profiles pr on pr.id = h.visitor
      where h.owner = p_owner and h.visitor <> me and h.until > now() and not pr.suspended), '[]'::jsonb),
    'party', public.arena_farm_party(p_owner),
    'partyLeft', greatest(0, 3600 - coalesce((select seconds from public.arena_farm_party_days
      where owner = p_owner and day = public.arena_today()), 0)))
$$;
revoke all on function public.arena_farm_here_view(uuid, uuid) from public, anon, authenticated, service_role;

-- "I am on this farm" (yours or a friend's), with an optional emote.
-- Also counts the owner's party time.
create or replace function public.arena_farm_here(p_owner uuid, p_emote text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); pd public.arena_farm_party_days;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_owner is null or (p_owner <> me and not public.arena_farm_are_friends(me, p_owner)) then
    raise exception 'Only friends can visit';
  end if;
  if p_emote is not null and (char_length(p_emote) > 8 or p_emote !~ '^[a-z]+$') then
    raise exception 'Unknown emote';
  end if;
  -- One farm at a time: being here ends being anywhere else.
  delete from public.arena_farm_presence where visitor = me and owner <> p_owner;
  -- Party time counts on the owner's own pings, at most 20 seconds a ping.
  if p_owner = me and public.arena_farm_party(me) then
    insert into public.arena_farm_party_days(owner, day) values (me, d) on conflict do nothing;
    select * into pd from public.arena_farm_party_days where owner = me and day = d for update;
    update public.arena_farm_party_days
       set seconds = least(3600, seconds + least(20, greatest(0,
             extract(epoch from now() - coalesce(pd.last_at, now()))::integer))),
           last_at = now()
     where owner = me and day = d;
  elsif p_owner = me then
    update public.arena_farm_party_days set last_at = null where owner = me and day = d;
  end if;
  insert into public.arena_farm_presence(owner, visitor, until, emote, emote_at)
  values (p_owner, me, now() + interval '40 seconds', p_emote, case when p_emote is not null then now() end)
  on conflict (owner, visitor) do update set until = excluded.until,
    emote = coalesce(excluded.emote, public.arena_farm_presence.emote),
    emote_at = coalesce(excluded.emote_at, public.arena_farm_presence.emote_at);
  return public.arena_farm_here_view(me, p_owner);
end; $$;
revoke all on function public.arena_farm_here(uuid, text) from public, anon;
grant execute on function public.arena_farm_here(uuid, text) to authenticated;

-- Leave a farm (closing it, or going home).
create or replace function public.arena_farm_gone() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null then raise exception 'Login required'; end if;
  delete from public.arena_farm_presence where visitor = me;
end; $$;
revoke all on function public.arena_farm_gone() from public, anon;
grant execute on function public.arena_farm_gone() to authenticated;

-- The Farm Tour: you and your friends' farms by this week's likes.
create or replace function public.arena_farm_tour_for(me uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with w as (select public.arena_plaza_week(public.arena_today()) wk),
  people as (
    select me id union
    select case when fs.a = me then fs.b else fs.a end from public.arena_friendships fs where fs.a = me or fs.b = me)
  select coalesce(jsonb_agg(x order by (x->>'likes')::integer desc, lower(x->>'name')), '[]'::jsonb) from (
    select jsonb_build_object('id', pr.id, 'name', pr.display_name, 'fighter', pr.portrait_character,
      'level', f.level, 'me', pr.id = me,
      'likes', (select count(*) from public.arena_farm_likes l where l.owner = pr.id and l.week = (select wk from w)),
      'liked', exists (select 1 from public.arena_farm_likes l
        where l.liker = me and l.owner = pr.id and l.week = (select wk from w)),
      'here', exists (select 1 from public.arena_farm_presence h
        where h.owner = pr.id and h.visitor = pr.id and h.until > now())) x
    from people p join public.arena_profiles pr on pr.id = p.id and not pr.suspended
    join public.arena_farms f on f.player_id = pr.id
    limit 101) y
$$;
revoke all on function public.arena_farm_tour_for(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_tour() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return public.arena_farm_tour_for(me);
end; $$;
revoke all on function public.arena_farm_tour() from public, anon;
grant execute on function public.arena_farm_tour() to authenticated;

create or replace function public.arena_farm_like(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_owner is null or p_owner = me or not public.arena_farm_are_friends(me, p_owner) then
    raise exception 'Only friends can like a farm';
  end if;
  insert into public.arena_farm_likes(liker, owner, week)
  values (me, p_owner, public.arena_plaza_week(public.arena_today())) on conflict do nothing;
  return jsonb_build_object('ok', found, 'error', case when not found then 'You liked this farm this week' end,
    'tour', public.arena_farm_tour_for(me));
end; $$;
revoke all on function public.arena_farm_like(uuid) from public, anon;
grant execute on function public.arena_farm_like(uuid) to authenticated;

commit;
