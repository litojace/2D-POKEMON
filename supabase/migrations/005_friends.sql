-- Friends: requests by friend code (or from a match), accept/decline, remove.
-- Run after 004_matches_achievements.sql. Who is online is added by the game
-- server, which knows the live connections; the database only keeps the list.
begin;

create table if not exists public.arena_friend_requests (
  from_id uuid not null references public.arena_profiles(id) on delete cascade,
  to_id uuid not null references public.arena_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists arena_friend_requests_to on public.arena_friend_requests(to_id);
-- One row per friendship, smaller id first.
create table if not exists public.arena_friendships (
  a uuid not null references public.arena_profiles(id) on delete cascade,
  b uuid not null references public.arena_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists arena_friendships_b on public.arena_friendships(b);
alter table public.arena_friend_requests enable row level security;
alter table public.arena_friendships enable row level security;
revoke all on public.arena_friend_requests, public.arena_friendships from anon, authenticated;

-- A player's friend code: the first 8 characters of their id, upper case.
create or replace function public.arena_friend_code(p_id uuid) returns text
language sql immutable set search_path='' as $$
 select upper(substr(replace(p_id::text, '-', ''), 1, 8));
$$;

create or replace function public.arena_require_player() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.arena_profiles where id=auth.uid() and not suspended) then
  raise exception 'Login required' using errcode='42501'; end if;
end; $$;

-- Ask to be friends, by friend code or (from a match) by player id. If they
-- already asked you, this accepts. Returns 'requested', 'friends' or 'already'.
create or replace function public.arena_friend_request(p_code text default null, p_player uuid default null) returns text
language plpgsql security definer set search_path='' as $$
declare target uuid; lo uuid; hi uuid;
begin
 perform public.arena_require_player();
 if p_player is not null then
  select id into target from public.arena_profiles where id=p_player;
 elsif p_code is not null and upper(trim(p_code)) ~ '^[0-9A-F]{8}$' then
  select id into target from public.arena_profiles
   where public.arena_friend_code(id) = upper(trim(p_code)) limit 1;
 end if;
 if target is null then raise exception 'No player has that friend code'; end if;
 if target = auth.uid() then raise exception 'That is your own friend code'; end if;
 lo := least(target, auth.uid()); hi := greatest(target, auth.uid());
 if exists(select 1 from public.arena_friendships where a=lo and b=hi) then return 'already'; end if;
 if exists(select 1 from public.arena_friend_requests where from_id=target and to_id=auth.uid()) then
  delete from public.arena_friend_requests where (from_id=target and to_id=auth.uid()) or (from_id=auth.uid() and to_id=target);
  insert into public.arena_friendships(a, b) values(lo, hi) on conflict do nothing;
  return 'friends';
 end if;
 if (select count(*) from public.arena_friend_requests where from_id=auth.uid()) >= 30 then
  raise exception 'Too many pending friend requests'; end if;
 insert into public.arena_friend_requests(from_id, to_id) values(auth.uid(), target) on conflict do nothing;
 return 'requested';
end; $$;

-- Accept or decline a request someone sent you.
create or replace function public.arena_friend_respond(p_from uuid, p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 delete from public.arena_friend_requests where from_id=p_from and to_id=auth.uid();
 if not found then raise exception 'That friend request is gone'; end if;
 if p_accept then
  insert into public.arena_friendships(a, b) values(least(p_from, auth.uid()), greatest(p_from, auth.uid())) on conflict do nothing;
 end if;
end; $$;

-- Unfriend, or cancel a request you sent.
create or replace function public.arena_friend_remove(p_player uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 delete from public.arena_friendships where a=least(p_player, auth.uid()) and b=greatest(p_player, auth.uid());
 delete from public.arena_friend_requests where from_id=auth.uid() and to_id=p_player;
end; $$;

-- Your friends, requests to you, and requests you sent.
create or replace function public.arena_friends() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.arena_require_player();
 select jsonb_build_object(
  'code', public.arena_friend_code(auth.uid()),
  'friends', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'title',t.name,'titleColor',t.color) order by lower(p.display_name))
    from public.arena_friendships f
    join public.arena_profiles p on p.id = case when f.a=auth.uid() then f.b else f.a end
    left join public.arena_titles t on t.id=p.equipped_title and t.active
    where (f.a=auth.uid() or f.b=auth.uid()) and not p.suspended),'[]'::jsonb),
  'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.from_id where r.to_id=auth.uid() and not p.suspended),'[]'::jsonb),
  'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.to_id where r.from_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end; $$;

revoke all on function public.arena_friend_code(uuid), public.arena_require_player(),
 public.arena_friend_request(text, uuid), public.arena_friend_respond(uuid, boolean),
 public.arena_friend_remove(uuid), public.arena_friends() from public, anon, authenticated;
grant execute on function public.arena_friend_request(text, uuid), public.arena_friend_respond(uuid, boolean),
 public.arena_friend_remove(uuid), public.arena_friends() to authenticated;
commit;
notify pgrst, 'reload schema';
