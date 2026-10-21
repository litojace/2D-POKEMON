-- Account levels, free monthly seasons, weekly goals, Arcade and Boss Rush XP.
-- Apply after 021_storm_twins.sql. Safe to run again. Existing balances and unlocks are preserved.
begin;
create table if not exists public.arena_player_xp (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  xp bigint not null default 0 check (xp between 0 and 2000000000)
);
create table if not exists public.arena_xp_ledger (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  source text not null, ref text not null, amount integer not null check(amount between 1 and 10000),
  day date not null, created_at timestamptz not null default now(), primary key(player_id,source,ref)
);
create index if not exists arena_xp_recent on public.arena_xp_ledger(player_id,created_at desc);
create table if not exists public.arena_season_xp (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  season text not null, xp bigint not null default 0, primary key(player_id,season)
);
create table if not exists public.arena_season_ledger (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  season text not null, ref text not null, primary key(player_id,season,ref)
);
create table if not exists public.arena_journey_receipts (id text primary key);
create table if not exists public.arena_weekly_goals (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null, play integer not null default 0, skills integer not null default 0,
  raids integer not null default 0, arcade integer not null default 0, completed text[] not null default '{}',
  primary key(player_id,week)
);
alter table public.arena_player_xp enable row level security;
alter table public.arena_xp_ledger enable row level security;
alter table public.arena_season_xp enable row level security;
alter table public.arena_season_ledger enable row level security;
alter table public.arena_journey_receipts enable row level security;
alter table public.arena_weekly_goals enable row level security;
revoke all on public.arena_player_xp,public.arena_xp_ledger,public.arena_season_xp,public.arena_season_ledger,public.arena_journey_receipts,public.arena_weekly_goals from public,anon,authenticated,service_role;

-- Reward-only cosmetics cannot be bought or appear in Today's Picks.
insert into public.arena_shop_items(id,kind,slot,name,rarity,price,active) values
  ('wayfarer-frame','look','frame','Wayfarer frame','epic',0,false),
  ('comet-arrival','look','entrance','Comet arrival','epic',0,false),
  ('trailblazer-aura','look','aura','Trailblazer aura','epic',0,false),
  ('aurora-colors','look','skin','Aurora colors','epic',0,false),
  ('meteor-finale','look','victory','Meteor finale','epic',0,false),
  ('champion-laurel','look','frame','Champion laurel','epic',0,false),
  ('astral-aura','look','aura','Astral aura','epic',0,false),
  ('season-aurora-frame','look','frame','Aurora Trails frame','epic',0,false),
  ('season-aurora-aura','look','aura','Aurora Trails aura','epic',0,false),
  ('season-aurora-colors','look','skin','Aurora Trails colors','epic',0,false),
  ('season-aurora-victory','look','victory','Aurora Trails finale','epic',0,false),
  ('season-ember-frame','look','frame','Ember Festival frame','epic',0,false),
  ('season-ember-aura','look','aura','Ember Festival aura','epic',0,false),
  ('season-ember-colors','look','skin','Ember Festival colors','epic',0,false),
  ('season-ember-victory','look','victory','Ember Festival finale','epic',0,false),
  ('season-tide-frame','look','frame','Tidal Voyage frame','epic',0,false),
  ('season-tide-aura','look','aura','Tidal Voyage aura','epic',0,false),
  ('season-tide-colors','look','skin','Tidal Voyage colors','epic',0,false),
  ('season-tide-victory','look','victory','Tidal Voyage finale','epic',0,false),
  ('season-astral-frame','look','frame','Astral Carnival frame','epic',0,false),
  ('season-astral-aura','look','aura','Astral Carnival aura','epic',0,false),
  ('season-astral-colors','look','skin','Astral Carnival colors','epic',0,false),
  ('season-astral-victory','look','victory','Astral Carnival finale','epic',0,false)
on conflict(id) do update set kind=excluded.kind,slot=excluded.slot,name=excluded.name,price=0,active=false;
insert into public.arena_titles(name,description,color,active)
select v.name,v.description,'#9ff3d8',true from (values
 ('Rising Spark','Reach player level 5.'),('Arena Vanguard','Reach player level 30.'),('Elemental Legend','Reach player level 50.')
) v(name,description) where not exists(select 1 from public.arena_titles t where t.name=v.name);

create or replace function public.arena_level_for(p_xp bigint) returns integer
language sql immutable as $$
 select coalesce(max(l),1)::integer from generate_series(1,50) l
 where (l-1)*100 + (l-1)*(l-2)*25/2 <= greatest(0,p_xp)
$$;
revoke all on function public.arena_level_for(bigint) from public,anon,authenticated,service_role;

create or replace function public.arena_add_season_xp(pid uuid, amount integer, ref text, d date) returns void
language plpgsql security definer set search_path=public as $$
declare sid text=to_char(d,'YYYY-MM'); old_xp bigint; new_xp bigint; inserted integer; tier integer; theme text; item text;
begin
 if amount<=0 then return; end if;
 insert into public.arena_season_ledger values(pid,sid,ref) on conflict do nothing;
 get diagnostics inserted=row_count; if inserted=0 then return; end if;
 insert into public.arena_season_xp(player_id,season) values(pid,sid) on conflict do nothing;
 select xp into old_xp from public.arena_season_xp where player_id=pid and season=sid for update;
 new_xp=least(2000000000,old_xp+least(10000,amount));
 update public.arena_season_xp set xp=new_xp where player_id=pid and season=sid;
 theme=(array['aurora','ember','tide','astral'])[(extract(year from d)::int*12+extract(month from d)::int-1)%4+1];
 if least(20,new_xp/400)>least(20,old_xp/400) then
  for tier in (least(20,old_xp/400)+1)::int..least(20,new_xp/400)::int loop
   perform public.arena_grant(pid,50,'season',sid||':'||tier,d);
   item=case tier when 5 then 'frame' when 10 then 'aura' when 15 then 'colors' when 20 then 'victory' else null end;
   if item is not null then
    item='season-'||theme||'-'||item;
    if exists(select 1 from public.arena_owned_items where player_id=pid and item_id=item) then
     perform public.arena_grant(pid,100,'season-repeat',sid||':'||tier,d);
    else
     insert into public.arena_owned_items(player_id,item_id) values(pid,item) on conflict do nothing;
    end if;
   end if;
  end loop;
 end if;
end; $$;
revoke all on function public.arena_add_season_xp(uuid,integer,text,date) from public,anon,authenticated,service_role;

create or replace function public.arena_add_xp(pid uuid, amount integer, source text, ref text, d date) returns void
language plpgsql security definer set search_path=public as $$
declare old_xp bigint; new_xp bigint; before_level integer; after_level integer; l integer; inserted integer; item text; v_title text;
begin
 if amount<=0 or not exists(select 1 from public.arena_profiles where id=pid and not suspended) then return; end if;
 insert into public.arena_xp_ledger values(pid,source,ref,least(10000,amount),d,now()) on conflict do nothing;
 get diagnostics inserted=row_count; if inserted=0 then return; end if;
 insert into public.arena_player_xp(player_id) values(pid) on conflict do nothing;
 select xp into old_xp from public.arena_player_xp where player_id=pid for update;
 new_xp=least(2000000000,old_xp+least(10000,amount));
 update public.arena_player_xp set xp=new_xp where player_id=pid;
 before_level=public.arena_level_for(old_xp);after_level=public.arena_level_for(new_xp);
 if after_level>before_level then
  for l in before_level+1..after_level loop
   perform public.arena_grant(pid,30,'level',l::text,d);
   item=case l when 10 then 'wayfarer-frame' when 15 then 'comet-arrival' when 20 then 'trailblazer-aura' when 25 then 'aurora-colors' when 35 then 'meteor-finale' when 40 then 'champion-laurel' when 45 then 'astral-aura' else null end;
   if item is not null then insert into public.arena_owned_items(player_id,item_id) values(pid,item) on conflict do nothing; end if;
   v_title=case l when 5 then 'Rising Spark' when 30 then 'Arena Vanguard' when 50 then 'Elemental Legend' else null end;
   if v_title is not null then
    insert into public.arena_player_titles(player_id,title_id) select pid,id from public.arena_titles where name=v_title on conflict do nothing;
   end if;
  end loop;
 end if;
 perform public.arena_add_season_xp(pid,amount,'xp:'||source||':'||ref,d);
end; $$;
revoke all on function public.arena_add_xp(uuid,integer,text,text,date) from public,anon,authenticated,service_role;

create or replace function public.arena_mission_xp() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.reason='mission' then perform public.arena_add_xp(new.player_id,50,'mission',new.ref,new.day); end if;
 return new;
end; $$;
revoke all on function public.arena_mission_xp() from public,anon,authenticated,service_role;
drop trigger if exists arena_mission_xp_award on public.arena_coin_ledger;
create trigger arena_mission_xp_award after insert on public.arena_coin_ledger for each row execute function public.arena_mission_xp();

-- Wrap the existing activity recorder so mission/coin/Mythic logic stays intact.
do $$ begin
 if to_regprocedure('public.arena_record_activity_before_journey(jsonb)') is null then
  alter function public.arena_record_activity(jsonb) rename to arena_record_activity_before_journey;
 end if;
 if to_regprocedure('public.arena_economy_before_journey()') is null then
  alter function public.arena_economy() rename to arena_economy_before_journey;
 end if;
end $$;
revoke all on function public.arena_record_activity_before_journey(jsonb),public.arena_economy_before_journey() from public,anon,authenticated,service_role;

create or replace function public.arena_record_activity(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare pl jsonb; pid uuid; d date=(p->>'day')::date; w date; rid text=p->>'id'; k text=p->>'kind';
 eligible jsonb; inserted integer; amount integer; active numeric; clear boolean; peril integer; legs integer; q public.arena_weekly_goals; goal text; val integer; target integer;
begin
 if k is null or k not in ('match','raid','expedition') or rid is null or length(rid)>160 or d is null
 or jsonb_typeof(p->'players') is distinct from 'array' or jsonb_array_length(p->'players') not between 1 and 4
 or d not between public.arena_today()-1 and public.arena_today()+1 then raise exception 'Invalid activity'; end if;
 insert into public.arena_journey_receipts values(rid) on conflict do nothing;
 get diagnostics inserted=row_count; if inserted=0 then return; end if;
 if k<>'expedition' then
  -- Idle or departed seats cannot earn mission XP indirectly through a teammate.
  -- Keep placeholder seats so filtering an idle teammate cannot turn co-op into a solo clear.
  select jsonb_agg(case when not coalesce((x.value->>'abandoned')::boolean,false)
     and coalesce((x.value->>'participated')::boolean,true) then x.value else '{"accountId":null}'::jsonb end)
   into eligible from jsonb_array_elements(p->'players') as x(value);
  perform public.arena_record_activity_before_journey(p || jsonb_build_object('players',eligible));
 end if;
 w=d-(extract(isodow from d)::int-1);
 for pl in select * from jsonb_array_elements(p->'players') loop
  pid=(pl->>'accountId')::uuid;
  if not exists(select 1 from public.arena_profiles where id=pid and not suspended) then continue; end if;
  active=coalesce((pl->>'activeSeconds')::numeric,0);
  if active<20 or coalesce((pl->>'abandoned')::boolean,false) or not coalesce((pl->>'participated')::boolean,true) then continue; end if;
  amount=0; legs=0;
  clear=coalesce((pl->'raid'->>'cleared')::boolean,false);
  peril=least(3,greatest(1,coalesce((pl->'raid'->>'peril')::int,1)));
  if k='match' then
   amount=case when coalesce((pl->>'vsPeople')::boolean,false) then 50+case when coalesce((pl->>'won')::boolean,false) then 25 else 0 end
               when pl->>'botLevel' is not null then 25 else 0 end;
  elsif k='raid' then
   amount=case when clear then (array[100,150,200])[peril] else 20*least(3,greatest(1,coalesce((pl->'raid'->>'phaseReached')::int,1))) end;
  elsif k='expedition' then
   legs=least(3,greatest(0,coalesce((pl->'expedition'->>'completed')::int,0)));
   amount=legs*80+case when legs=3 then 100 else 20 end;
   if legs>0 and (select count(*) from public.arena_coin_ledger where player_id=pid and day=d and reason='expedition')<3 then
    perform public.arena_grant(pid,legs*30+case when legs=3 then 50 else 0 end,'expedition',rid,d);
   end if;
  end if;
  perform public.arena_add_xp(pid,amount,k,rid,d);
  if amount<=0 then continue; end if;
  insert into public.arena_weekly_goals(player_id,week) values(pid,w) on conflict do nothing;
  update public.arena_weekly_goals set play=least(5,play+1),skills=least(50,skills+least(500,greatest(0,coalesce((pl->>'skillUses')::int,0)))),
   raids=least(2,raids+case when k='raid' and clear then 1 when k='expedition' then legs else 0 end),
   arcade=least(3,arcade+case when k='match' and pl->>'arcade' is not null then 1 else 0 end)
   where player_id=pid and week=w returning * into q;
  foreach goal in array array['play','skills','raids','arcade'] loop
   val=case goal when 'play' then q.play when 'skills' then q.skills when 'raids' then q.raids else q.arcade end;
   target=case goal when 'play' then 5 when 'skills' then 50 when 'raids' then 2 else 3 end;
   if val>=target and not goal=any(q.completed) then
    update public.arena_weekly_goals set completed=array_append(completed,goal) where player_id=pid and week=w;
    perform public.arena_add_season_xp(pid,250,'weekly:'||w||':'||goal,d);
   end if;
  end loop;
 end loop;
end; $$;
revoke all on function public.arena_record_activity(jsonb) from public,anon,authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

create or replace function public.arena_journey() returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid=auth.uid(); d date=public.arena_today(); w date; sid text=to_char(d,'YYYY-MM');
begin
 if me is null or not exists(select 1 from public.arena_profiles where id=me and not suspended) then raise exception 'Login required'; end if;
 w=d-(extract(isodow from d)::int-1);
 return jsonb_build_object(
  'xp',coalesce((select xp from public.arena_player_xp where player_id=me),0),
  'recent',coalesce((select jsonb_agg(to_jsonb(r)) from (select ref,amount,source,created_at as at from public.arena_xp_ledger where player_id=me order by created_at desc,ref limit 12) r),'[]'::jsonb),
  'season',jsonb_build_object('id',sid,'xp',coalesce((select xp from public.arena_season_xp where player_id=me and season=sid),0),'week',w,
   'goals',coalesce((select jsonb_build_object('play',play,'skills',skills,'raids',raids,'arcade',arcade) from public.arena_weekly_goals where player_id=me and week=w),'{}'::jsonb),
   'completed',coalesce((select to_jsonb(completed) from public.arena_weekly_goals where player_id=me and week=w),'[]'::jsonb)),
  'unlocked',coalesce((select jsonb_agg(o.item_id order by o.item_id) from public.arena_owned_items o join public.arena_shop_items i on i.id=o.item_id where o.player_id=me and i.kind='look' and not i.active),'[]'::jsonb));
end; $$;
revoke all on function public.arena_journey() from public,anon;
grant execute on function public.arena_journey() to authenticated;
create or replace function public.arena_economy() returns jsonb
language sql security definer set search_path=public as $$
 select public.arena_economy_before_journey() || jsonb_build_object('journey',public.arena_journey())
$$;
revoke all on function public.arena_economy() from public,anon;
grant execute on function public.arena_economy() to authenticated;
commit;
select to_regprocedure('public.arena_journey()') is not null as journey_enabled;
