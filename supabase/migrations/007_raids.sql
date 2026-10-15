-- Co-op records are written ONLY by the game server's service-role client.
-- Raid clears never touch arena_matches, Elo, or PvP leaderboards.
begin;
create table if not exists public.arena_raid_runs (
 id uuid primary key, boss text not null, peril integer not null check(peril between 1 and 3),
 trait text not null, gilded boolean not null, weekly boolean not null, week date not null,
 party_size integer not null check(party_size between 1 and 4), seconds numeric not null check(seconds>0),
 downs integer not null, revives integer not null, receipt jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.arena_raid_players (
 run_id uuid references public.arena_raid_runs(id) on delete cascade,
 player_id uuid references public.arena_profiles(id) on delete cascade,
 character text not null, primary key(run_id,player_id)
);
create table if not exists public.arena_raid_loadouts (
 player_id uuid primary key references public.arena_profiles(id) on delete cascade,
 cosmetic text check(cosmetic in ('cragbound','mountain-aura'))
);
create index if not exists arena_raid_weekly on public.arena_raid_runs(week,party_size,seconds) where weekly;
create index if not exists arena_raid_player_lookup on public.arena_raid_players(player_id);
alter table public.arena_raid_runs enable row level security;
alter table public.arena_raid_players enable row level security;
alter table public.arena_raid_loadouts enable row level security;
revoke all on public.arena_raid_runs,public.arena_raid_players,public.arena_raid_loadouts from anon,authenticated;

insert into public.arena_titles(name,description,color,active)
select name,description,color,true from (values
 ('Cragbreaker','Defeat Grumblecrag in a co-op raid.','#e5bc73'),
 ('Mountain Conqueror','Defeat Grumblecrag at Peril 3.','#ffcf66'),
 ('Gilded Cragbreaker','Defeat a rare Gilded Grumblecrag.','#ffe991')
) v(name,description,color) where not exists(select 1 from public.arena_titles t where t.name=v.name);

create or replace function public.arena_record_raid(p_receipt jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare player jsonb; pid uuid; clears integer; inserted integer;
begin
 if p_receipt->>'boss'<>'grumblecrag' or jsonb_array_length(p_receipt->'players') not between 1 and 4 then raise exception 'Invalid raid';end if;
 insert into public.arena_raid_runs values (
 (p_receipt->>'id')::uuid,p_receipt->>'boss',(p_receipt->>'peril')::integer,p_receipt->>'trait',
 (p_receipt->>'gilded')::boolean,(p_receipt->>'weekly')::boolean,(p_receipt->>'week')::date,
 (p_receipt->>'partySize')::integer,(p_receipt->>'seconds')::numeric,(p_receipt->>'downs')::integer,(p_receipt->>'revives')::integer,p_receipt,now()) on conflict do nothing;
 get diagnostics inserted=row_count;if inserted=0 then return;end if;
 for player in select * from jsonb_array_elements(p_receipt->'players') loop
  pid=(player->>'accountId')::uuid;
  insert into public.arena_raid_players values((p_receipt->>'id')::uuid,pid,player->>'character');
  insert into public.arena_player_titles(player_id,title_id)
  select pid,t.id from public.arena_titles t where t.name='Cragbreaker'
    or (t.name='Mountain Conqueror' and (p_receipt->>'peril')::integer=3)
    or (t.name='Gilded Cragbreaker' and (p_receipt->>'gilded')::boolean)
  on conflict do nothing;
 end loop;
end;$$;
revoke all on function public.arena_record_raid(jsonb) from public,anon,authenticated;
grant execute on function public.arena_record_raid(jsonb) to service_role;

create or replace function public.arena_raid_progress() returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid=auth.uid(); result jsonb; clears integer; highest integer; best numeric; cosmetics jsonb='[]'; unbroken boolean;
begin
 if me is null then raise exception 'Login required';end if;
 select count(*),coalesce(max(r.peril),0),min(r.seconds),coalesce(bool_or(r.peril=3 and r.downs=0),false)
 into clears,highest,best,unbroken from public.arena_raid_runs r join public.arena_raid_players p on p.run_id=r.id where p.player_id=me;
 if clears>=5 then cosmetics=cosmetics||'"cragbound"'::jsonb;end if;
 if unbroken then cosmetics=cosmetics||'"mountain-aura"'::jsonb;end if;
 result=jsonb_build_object('clears',clears,'highestPeril',highest,'bestSeconds',best,'cosmetics',cosmetics,
 'equipped',(select cosmetic from public.arena_raid_loadouts where player_id=me),
 'titles',case when highest=0 then '[]'::jsonb when highest<3 then '["Cragbreaker"]'::jsonb else '["Cragbreaker","Mountain Conqueror"]'::jsonb end,
 'weekly',coalesce((select jsonb_agg(to_jsonb(q)) from (
 select r.party_size as "partySize",r.seconds,r.peril,
 (select jsonb_agg(pr.display_name order by pr.display_name) from public.arena_raid_players rp join public.arena_profiles pr on pr.id=rp.player_id where rp.run_id=r.id) as names
 from (select rr.*,row_number()over(partition by rr.party_size order by rr.seconds,rr.id) as place from public.arena_raid_runs rr where rr.weekly and rr.week=date_trunc('week',now() at time zone 'utc')::date) r where r.place<=10
 order by r.party_size,r.seconds limit 40)q),'[]'::jsonb));
 return result;
end;$$;
revoke all on function public.arena_raid_progress() from public,anon;
grant execute on function public.arena_raid_progress() to authenticated;

create or replace function public.arena_equip_raid_cosmetic(p_cosmetic text) returns void
language plpgsql security definer set search_path=public as $$
declare progress jsonb;
begin
 progress=public.arena_raid_progress();
 if p_cosmetic is not null and not (progress->'cosmetics' ? p_cosmetic) then raise exception 'Cosmetic not earned';end if;
 insert into public.arena_raid_loadouts values(auth.uid(),p_cosmetic) on conflict(player_id) do update set cosmetic=excluded.cosmetic;
end;$$;
revoke all on function public.arena_equip_raid_cosmetic(text) from public,anon;
grant execute on function public.arena_equip_raid_cosmetic(text) to authenticated;
commit;
