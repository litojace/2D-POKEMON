-- Match history (docs/match-history.md): your PvP and bot matches, newest
-- first, a page at a time, on your player card and on your friends' cards.
--
-- Read-only, from tables that already exist: arena_match_players (migration
-- 004) for whose matches they are, arena_matches for the summary everyone
-- reported, arena_rating_changes (006) for the rating each match moved.
-- Only you and your friends may read a player's history: anyone else is
-- refused (friendships end when either player blocks the other).
--
-- Safe to run again: a function replaced, grants set again.
begin;

create or replace function public.arena_match_history(
  p_player uuid,
  p_before_at timestamptz default null,
  p_before_id text default null,
  p_limit integer default 10,
  p_kind text default 'all'
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 10), 1), 30);
  kind text := case when p_kind in ('pvp', 'bot') then p_kind else 'all' end;
  page jsonb;
  more boolean;
  people jsonb;
  totals jsonb := null;
  rating jsonb := null;
begin
  perform public.arena_require_player();
  if p_player is null then
    raise exception 'Choose a player.' using errcode = '22023';
  end if;
  if p_player <> me and not exists (
    select 1 from public.arena_friendships f
    join public.arena_profiles p on p.id = p_player and not p.suspended
    where f.a = least(me, p_player) and f.b = greatest(me, p_player)
  ) then
    raise exception 'Only friends can see each other''s matches.' using errcode = '42501';
  end if;

  -- One page (and one row more, to know whether another page follows).
  select coalesce(jsonb_agg(x.j order by x.played_at desc, x.id desc), '[]'::jsonb)
    into page
  from (
    select m.played_at, m.id, jsonb_build_object(
      'id', m.id,
      'playedAt', m.played_at,
      'mode', m.mode,
      'arena', m.arena,
      'vsBot', m.vs_bot,
      'team', mp.team,
      'won', mp.won,
      'character', mp.character,
      'summary', m.summary,
      'ratingBefore', rc.before,
      'ratingAfter', rc.after
    ) as j
    from public.arena_match_players mp
    join public.arena_matches m on m.id = mp.match_id
    left join public.arena_rating_changes rc
      on rc.match_id = mp.match_id and rc.player_id = mp.player_id
    where mp.player_id = p_player
      and (kind = 'all' or (kind = 'bot') = m.vs_bot)
      and (p_before_at is null
        or m.played_at < p_before_at
        or (m.played_at = p_before_at and p_before_id is not null and m.id < p_before_id))
    order by m.played_at desc, m.id desc
    limit lim + 1
  ) x;
  more := jsonb_array_length(page) > lim;
  if more then page := page - lim; end if;

  -- Everyone in those matches as they are now: their current name and
  -- avatar (a deleted account is gone from here and shows as it was saved).
  select coalesce(jsonb_object_agg(p.id::text, jsonb_build_object(
      'name', p.display_name, 'avatar', p.avatar)), '{}'::jsonb)
    into people
  from public.arena_profiles p
  where p.id in (
    select (pl->>'account')::uuid
    from jsonb_array_elements(page) r,
      jsonb_array_elements(r->'summary'->'players') pl
    where pl->>'account' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

  -- The first page also carries the totals and rating for the card's head.
  if p_before_at is null then
    select jsonb_build_object(
      'matches', count(*),
      'wins', count(*) filter (where mp.won),
      'fighters', coalesce((
        select jsonb_object_agg(f.character, jsonb_build_object('matches', f.n, 'wins', f.w))
        from (
          select character, count(*) as n, count(*) filter (where won) as w
          from public.arena_match_players
          where player_id = p_player
          group by character
        ) f), '{}'::jsonb)
    ) into totals
    from public.arena_match_players mp
    where mp.player_id = p_player;
    rating := public.arena_rating_of(p_player);
  end if;

  return jsonb_build_object(
    'matches', page,
    'more', more,
    'people', people,
    'totals', totals,
    'rating', rating
  );
end; $$;

revoke all on function public.arena_match_history(uuid, timestamptz, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.arena_match_history(uuid, timestamptz, text, integer, text)
  to authenticated;

commit;
notify pgrst, 'reload schema';
