-- The Shop: coins, daily missions, champion skins, collections, Mythic
-- Trials and Awakening. Coins are only ever granted by the game server's
-- service-role client (arena_record_activity); players can only spend them
-- (arena_buy_item). Everything sold is cosmetic. Run after 001–009.
begin;

-- Catalog (seeded from packages/shared/src/shop.ts by scripts/shop-seed.ts).
create table if not exists public.arena_shop_items (
  id text primary key,
  kind text not null check (kind in ('champion', 'look', 'bundle')),
  champion text,
  slot text check (slot in ('skin', 'aura', 'entrance', 'frame', 'victory')),
  name text not null,
  rarity text check (rarity in ('common', 'rare', 'epic', 'mythical')),
  collection text,
  price integer not null check (price >= 0),
  items text[],
  active boolean not null default true
);
create table if not exists public.arena_missions (
  id text primary key,
  tier text not null check (tier in ('easy', 'medium', 'hard')),
  text text not null,
  metric text not null,
  target integer not null check (target > 0),
  coins integer not null check (coins >= 0),
  champions text[],
  active boolean not null default true
);
insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-midnight', 'champion', 'voltkit', null, 'Midnight', 'common', null, 500, null),
  ('voltkit-peach-fizz', 'champion', 'voltkit', null, 'Peach Fizz', 'common', null, 500, null),
  ('voltkit-mint-static', 'champion', 'voltkit', null, 'Mint Static', 'common', null, 500, null),
  ('voltkit-snowcap', 'champion', 'voltkit', null, 'Snowcap', 'rare', 'winter', 1500, null),
  ('voltkit-kite-runner', 'champion', 'voltkit', null, 'Kite Runner', 'rare', 'festival', 1500, null),
  ('voltkit-neon-arcade', 'champion', 'voltkit', null, 'Neon Arcade', 'epic', 'arcade', 3500, null),
  ('voltkit-stormcrown', 'champion', 'voltkit', null, 'Stormcrown', 'mythical', 'celestial', 8000, null),
  ('cindrake-ashen', 'champion', 'cindrake', null, 'Ashen', 'common', null, 500, null),
  ('cindrake-coral', 'champion', 'cindrake', null, 'Coral', 'common', null, 500, null),
  ('cindrake-lime-flame', 'champion', 'cindrake', null, 'Lime Flame', 'common', null, 500, null),
  ('cindrake-chili-pepper', 'champion', 'cindrake', null, 'Chili Pepper', 'rare', 'garden', 1500, null),
  ('cindrake-blue-flame', 'champion', 'cindrake', null, 'Blue Flame', 'rare', 'winter', 1500, null),
  ('cindrake-volcano-forge', 'champion', 'cindrake', null, 'Volcano Forge', 'epic', 'festival', 3500, null),
  ('cindrake-sunforged', 'champion', 'cindrake', null, 'Sunforged', 'mythical', 'celestial', 8000, null),
  ('tidefin-bubblegum', 'champion', 'tidefin', null, 'Bubblegum', 'common', null, 500, null),
  ('tidefin-abyss', 'champion', 'tidefin', null, 'Abyss', 'common', null, 500, null),
  ('tidefin-sandbar', 'champion', 'tidefin', null, 'Sandbar', 'common', null, 500, null),
  ('tidefin-koi-pond', 'champion', 'tidefin', null, 'Koi Pond', 'rare', 'garden', 1500, null),
  ('tidefin-corsair', 'champion', 'tidefin', null, 'Corsair', 'rare', 'festival', 1500, null),
  ('tidefin-glacier', 'champion', 'tidefin', null, 'Glacier', 'epic', 'winter', 3500, null),
  ('tidefin-moontide', 'champion', 'tidefin', null, 'Moontide', 'mythical', 'celestial', 8000, null),
  ('auralynx-snowshoe', 'champion', 'auralynx', null, 'Snowshoe', 'common', null, 500, null),
  ('auralynx-desert', 'champion', 'auralynx', null, 'Desert', 'common', null, 500, null),
  ('auralynx-twilight', 'champion', 'auralynx', null, 'Twilight', 'common', null, 500, null),
  ('auralynx-cherry-blossom', 'champion', 'auralynx', null, 'Cherry Blossom', 'rare', 'garden', 1500, null),
  ('auralynx-jade-temple', 'champion', 'auralynx', null, 'Jade Temple', 'rare', 'festival', 1500, null),
  ('auralynx-stained-glass', 'champion', 'auralynx', null, 'Stained Glass', 'epic', 'arcade', 3500, null),
  ('auralynx-celestial-sage', 'champion', 'auralynx', null, 'Celestial Sage', 'mythical', 'celestial', 8000, null),
  ('lumoth-lunar', 'champion', 'lumoth', null, 'Lunar', 'common', null, 500, null),
  ('lumoth-peachy', 'champion', 'lumoth', null, 'Peachy', 'common', null, 500, null),
  ('lumoth-dusk', 'champion', 'lumoth', null, 'Dusk', 'common', null, 500, null),
  ('lumoth-rosy-maple', 'champion', 'lumoth', null, 'Rosy Maple', 'rare', 'garden', 1500, null),
  ('lumoth-paper-lantern', 'champion', 'lumoth', null, 'Paper Lantern', 'rare', 'festival', 1500, null),
  ('lumoth-aurora', 'champion', 'lumoth', null, 'Aurora', 'epic', 'winter', 3500, null),
  ('lumoth-starweaver', 'champion', 'lumoth', null, 'Starweaver', 'mythical', 'celestial', 8000, null),
  ('mystowl-snowy', 'champion', 'mystowl', null, 'Snowy', 'common', null, 500, null),
  ('mystowl-barn', 'champion', 'mystowl', null, 'Barn', 'common', null, 500, null),
  ('mystowl-midnight', 'champion', 'mystowl', null, 'Midnight', 'common', null, 500, null),
  ('mystowl-scholar', 'champion', 'mystowl', null, 'Scholar', 'rare', 'festival', 1500, null),
  ('mystowl-witchs-familiar', 'champion', 'mystowl', null, 'Witch''s Familiar', 'rare', 'garden', 1500, null),
  ('mystowl-clockwork', 'champion', 'mystowl', null, 'Clockwork', 'epic', 'arcade', 3500, null),
  ('mystowl-oracle', 'champion', 'mystowl', null, 'Oracle', 'mythical', 'celestial', 8000, null),
  ('terradon-mossy', 'champion', 'terradon', null, 'Mossy', 'common', null, 500, null),
  ('terradon-sandstone', 'champion', 'terradon', null, 'Sandstone', 'common', null, 500, null),
  ('terradon-granite', 'champion', 'terradon', null, 'Granite', 'common', null, 500, null),
  ('terradon-bonsai', 'champion', 'terradon', null, 'Bonsai', 'rare', 'garden', 1500, null),
  ('terradon-snowball', 'champion', 'terradon', null, 'Snowball', 'rare', 'winter', 1500, null),
  ('terradon-geode', 'champion', 'terradon', null, 'Geode', 'epic', 'arcade', 3500, null),
  ('terradon-world-shell', 'champion', 'terradon', null, 'World-Shell', 'mythical', 'celestial', 8000, null),
  ('duskveil-ember', 'champion', 'duskveil', null, 'Ember', 'common', null, 500, null),
  ('duskveil-ghost-white', 'champion', 'duskveil', null, 'Ghost White', 'common', null, 500, null),
  ('duskveil-teal-spirit', 'champion', 'duskveil', null, 'Teal Spirit', 'common', null, 500, null),
  ('duskveil-pumpkin-lantern', 'champion', 'duskveil', null, 'Pumpkin Lantern', 'rare', 'festival', 1500, null),
  ('duskveil-paper-lantern', 'champion', 'duskveil', null, 'Paper Lantern', 'rare', 'festival', 1500, null),
  ('duskveil-candlelight', 'champion', 'duskveil', null, 'Candlelight', 'epic', 'garden', 3500, null),
  ('duskveil-eclipse', 'champion', 'duskveil', null, 'Eclipse', 'mythical', 'celestial', 8000, null),
  ('candy-colours', 'look', null, 'skin', 'Candy colours', 'common', 'candy', 300, null),
  ('candy-aura', 'look', null, 'aura', 'Sprinkle aura', 'rare', 'candy', 900, null),
  ('candy-entrance', 'look', null, 'entrance', 'Gift-box entrance', 'rare', 'candy', 1000, null),
  ('candy-frame', 'look', null, 'frame', 'Cookie frame', 'rare', 'candy', 800, null),
  ('candy-victory', 'look', null, 'victory', 'Cake victory', 'epic', 'candy', 1800, null),
  ('galaxy-colours', 'look', null, 'skin', 'Galaxy colours', 'common', 'galaxy', 300, null),
  ('galaxy-aura', 'look', null, 'aura', 'Nebula aura', 'rare', 'galaxy', 900, null),
  ('galaxy-entrance', 'look', null, 'entrance', 'Star-tunnel entrance', 'rare', 'galaxy', 1000, null),
  ('galaxy-frame', 'look', null, 'frame', 'Planet-ring frame', 'rare', 'galaxy', 800, null),
  ('galaxy-victory', 'look', null, 'victory', 'Supernova victory', 'epic', 'galaxy', 1800, null),
  ('retro-colours', 'look', null, 'skin', 'Retro colours', 'common', 'retro', 300, null),
  ('retro-aura', 'look', null, 'aura', 'Pixel-heart aura', 'rare', 'retro', 900, null),
  ('retro-entrance', 'look', null, 'entrance', 'Player One entrance', 'rare', 'retro', 1000, null),
  ('retro-frame', 'look', null, 'frame', 'Cartridge frame', 'rare', 'retro', 800, null),
  ('retro-victory', 'look', null, 'victory', 'Level Up victory', 'epic', 'retro', 1800, null),
  ('festival-colours', 'look', null, 'skin', 'Festival colours', 'common', 'festival', 300, null),
  ('festival-aura', 'look', null, 'aura', 'Lantern aura', 'rare', 'festival', 900, null),
  ('festival-entrance', 'look', null, 'entrance', 'Firecracker entrance', 'rare', 'festival', 1000, null),
  ('festival-frame', 'look', null, 'frame', 'Tassel frame', 'rare', 'festival', 800, null),
  ('festival-victory', 'look', null, 'victory', 'Fireworks victory', 'epic', 'festival', 1800, null),
  ('garden-colours', 'look', null, 'skin', 'Spring colours', 'common', 'garden', 300, null),
  ('garden-aura', 'look', null, 'aura', 'Petal aura', 'rare', 'garden', 900, null),
  ('garden-entrance', 'look', null, 'entrance', 'Bloom entrance', 'rare', 'garden', 1000, null),
  ('garden-frame', 'look', null, 'frame', 'Vine frame', 'rare', 'garden', 800, null),
  ('garden-victory', 'look', null, 'victory', 'Flower-shower victory', 'epic', 'garden', 1800, null),
  ('winter-colours', 'look', null, 'skin', 'Frost colours', 'common', 'winter', 300, null),
  ('winter-aura', 'look', null, 'aura', 'Snowflake aura', 'rare', 'winter', 900, null),
  ('winter-entrance', 'look', null, 'entrance', 'Flurry entrance', 'rare', 'winter', 1000, null),
  ('winter-frame', 'look', null, 'frame', 'Icicle frame', 'rare', 'winter', 800, null),
  ('winter-victory', 'look', null, 'victory', 'Snow-globe victory', 'epic', 'winter', 1800, null),
  ('candy-set', 'bundle', null, null, 'Candy set', null, 'candy', 0, array['candy-colours', 'candy-aura', 'candy-entrance', 'candy-frame', 'candy-victory']),
  ('galaxy-set', 'bundle', null, null, 'Galaxy set', null, 'galaxy', 0, array['galaxy-colours', 'galaxy-aura', 'galaxy-entrance', 'galaxy-frame', 'galaxy-victory']),
  ('retro-set', 'bundle', null, null, 'Retro Pixel set', null, 'retro', 0, array['retro-colours', 'retro-aura', 'retro-entrance', 'retro-frame', 'retro-victory']),
  ('festival-set', 'bundle', null, null, 'Festival set', null, 'festival', 0, array['festival-colours', 'festival-aura', 'festival-entrance', 'festival-frame', 'festival-victory']),
  ('garden-set', 'bundle', null, null, 'Garden set', null, 'garden', 0, array['garden-colours', 'garden-aura', 'garden-entrance', 'garden-frame', 'garden-victory']),
  ('winter-set', 'bundle', null, null, 'Winter set', null, 'winter', 0, array['winter-colours', 'winter-aura', 'winter-entrance', 'winter-frame', 'winter-victory'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;
insert into public.arena_missions(id, tier, text, metric, target, coins, champions) values
  ('play-2', 'easy', 'Play 2 matches', 'play', 2, 40, null),
  ('raid-1', 'easy', 'Clear any raid', 'raid-clear', 1, 40, null),
  ('skills-30', 'easy', 'Use 30 skills', 'skill-uses', 30, 40, null),
  ('ults-3', 'easy', 'Use your ultimate 3 times', 'ults', 3, 40, null),
  ('pvp-wins-2', 'medium', 'Win 2 matches against players', 'pvp-wins', 2, 70, null),
  ('daily-1', 'medium', 'Clear today''s Raid of the Day', 'daily-clear', 1, 70, null),
  ('revives-3', 'medium', 'Help revive 3 allies in raids', 'revives', 3, 70, null),
  ('earth-water', 'medium', 'Win a match as Terradon or Tidefin', 'wins-with', 1, 70, array['terradon', 'tidefin']),
  ('fire-light', 'medium', 'Win a match as Cindrake or Lumoth', 'wins-with', 1, 70, array['cindrake', 'lumoth']),
  ('hard-bot', 'medium', 'Beat a Hard bot', 'hard-bot-win', 1, 70, null),
  ('raid-p3', 'hard', 'Clear any raid on Peril 3', 'raid-peril3', 1, 120, null),
  ('raid-flawless', 'hard', 'Clear a raid with no downs', 'raid-flawless', 1, 120, null),
  ('teams-unharmed', 'hard', 'Win a 2v2 without being knocked out', 'teams-unharmed', 1, 120, null),
  ('feat-1', 'hard', 'Complete a boss feat', 'feat', 1, 120, null),
  ('pvp-wins-5', 'hard', 'Win 5 matches against players', 'pvp-wins', 5, 120, null)
on conflict (id) do update set tier = excluded.tier, text = excluded.text, metric = excluded.metric,
  target = excluded.target, coins = excluded.coins, champions = excluded.champions;

create table if not exists public.arena_wallets (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0)
);
-- Every coin in and out, once per (player, reason, ref): a retried save never pays twice.
create table if not exists public.arena_coin_ledger (
  id bigserial primary key,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  ref text not null,
  day date not null,
  created_at timestamptz not null default now(),
  unique (player_id, reason, ref)
);
create index if not exists arena_coin_ledger_day on public.arena_coin_ledger(player_id, day, reason);
create table if not exists public.arena_owned_items (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  item_id text not null references public.arena_shop_items(id),
  acquired_at timestamptz not null default now(),
  primary key (player_id, item_id)
);
create table if not exists public.arena_champion_looks (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  champion text not null,
  skin text not null references public.arena_shop_items(id),
  stage integer not null default 1 check (stage between 1 and 3),
  primary key (player_id, champion)
);
create table if not exists public.arena_mission_days (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  rerolled boolean not null default false,
  bonus boolean not null default false,
  primary key (player_id, day)
);
create table if not exists public.arena_mission_progress (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  slot integer not null check (slot between 0 and 2),
  mission_id text not null references public.arena_missions(id),
  progress integer not null default 0,
  done boolean not null default false,
  primary key (player_id, day, slot)
);
-- Server receipts already counted (idempotency).
create table if not exists public.arena_activity (
  id text primary key,
  kind text not null,
  day date not null,
  created_at timestamptz not null default now()
);
-- Wins that count for Mythic Trials: against players, or raid clears.
create table if not exists public.arena_champion_wins (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  champion text not null,
  wins integer not null default 0,
  primary key (player_id, champion)
);
-- Awakening progress: wins wearing a Mythical, and a Peril 3 clear in it.
create table if not exists public.arena_skin_progress (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  skin_id text not null references public.arena_shop_items(id),
  wins integer not null default 0,
  peril3 boolean not null default false,
  primary key (player_id, skin_id)
);
alter table public.arena_shop_items enable row level security;
alter table public.arena_missions enable row level security;
alter table public.arena_wallets enable row level security;
alter table public.arena_coin_ledger enable row level security;
alter table public.arena_owned_items enable row level security;
alter table public.arena_champion_looks enable row level security;
alter table public.arena_mission_days enable row level security;
alter table public.arena_mission_progress enable row level security;
alter table public.arena_activity enable row level security;
alter table public.arena_champion_wins enable row level security;
alter table public.arena_skin_progress enable row level security;
revoke all on public.arena_shop_items, public.arena_missions, public.arena_wallets,
  public.arena_coin_ledger, public.arena_owned_items, public.arena_champion_looks,
  public.arena_mission_days, public.arena_mission_progress, public.arena_activity,
  public.arena_champion_wins, public.arena_skin_progress from anon, authenticated;

-- Trial wins so far: confirmed wins against people, plus raid clears.
insert into public.arena_champion_wins(player_id, champion, wins)
select player_id, character, count(*) from (
  select mp.player_id, mp.character from public.arena_match_players mp
    join public.arena_matches m on m.id = mp.match_id
   where mp.won and not m.vs_bot
  union all
  select rp.player_id, rp.character from public.arena_raid_players rp
    join public.arena_raid_runs r on r.id = rp.run_id
   where r.result = 'victory'
) w group by player_id, character
on conflict (player_id, champion) do nothing;

-- Pacific "today", the day missions and picks change.
create or replace function public.arena_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'America/Los_Angeles')::date
$$;

-- A day's mission for a tier (offset 1 = the re-roll), the same for everyone.
create or replace function public.arena_daily_mission(p_day date, p_tier text, p_offset integer)
returns text language sql stable security definer set search_path = public as $$
  select id from public.arena_missions where active and tier = p_tier
   order by md5(p_day::text || ':' || id) offset p_offset limit 1
$$;

-- Today's Picks: four items; the first non-Mythical one is the deal.
create or replace function public.arena_shop_picks(p_day date)
returns table(item_id text, deal boolean) language sql stable security definer set search_path = public as $$
  with picked as (
    select id, rarity, row_number() over (order by md5('picks:' || p_day::text || ':' || id)) as n
      from public.arena_shop_items where active and kind <> 'bundle'
  ), top as (select * from picked where n <= 4)
  select id, id = (select id from top where rarity <> 'mythical' order by n limit 1) from top order by n
$$;

create or replace function public.arena_ensure_missions(pid uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.arena_mission_days(player_id, day) values (pid, p_day) on conflict do nothing;
  insert into public.arena_mission_progress(player_id, day, slot, mission_id)
  select pid, p_day, s.slot, public.arena_daily_mission(p_day, s.tier, 0)
    from (values (0, 'easy'), (1, 'medium'), (2, 'hard')) s(slot, tier)
   where public.arena_daily_mission(p_day, s.tier, 0) is not null
  on conflict do nothing;
end; $$;

-- Pay coins once per (reason, ref). Returns whether it paid.
create or replace function public.arena_grant(pid uuid, p_amount integer, p_reason text, p_ref text, p_day date)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into public.arena_coin_ledger(player_id, amount, reason, ref, day)
  values (pid, p_amount, p_reason, p_ref, p_day) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  insert into public.arena_wallets(player_id, balance) values (pid, greatest(0, p_amount))
  on conflict (player_id) do update set balance = public.arena_wallets.balance + p_amount;
  return true;
end; $$;

-- Days in a row with all three missions done, ending today (or yesterday
-- when today isn't finished yet).
create or replace function public.arena_mission_streak(pid uuid, p_day date) returns integer
language plpgsql stable security definer set search_path = public as $$
declare n integer = 0; start date = p_day;
begin
  if not exists (select 1 from public.arena_mission_days where player_id = pid and day = p_day and bonus) then
    start = p_day - 1;
  end if;
  while n < 400 and exists (select 1 from public.arena_mission_days
                             where player_id = pid and day = start - n and bonus) loop
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke all on function public.arena_mission_streak(uuid, date) from public, anon, authenticated, service_role;

-- Advance today's missions that use a metric; pay finished ones, the
-- all-three bonus, and the 7-day streak bonus.
create or replace function public.arena_mission_bump(pid uuid, p_day date, p_metric text, p_amount integer, p_character text)
returns void language plpgsql security definer set search_path = public as $$
declare row record; streak integer;
begin
  if p_amount <= 0 then return; end if;
  perform public.arena_ensure_missions(pid, p_day);
  for row in
    update public.arena_mission_progress mp
       set progress = least(m.target, mp.progress + p_amount)
      from public.arena_missions m
     where mp.player_id = pid and mp.day = p_day and not mp.done
       and m.id = mp.mission_id and m.metric = p_metric
       and (m.champions is null or p_character = any(m.champions))
    returning mp.slot, mp.progress, m.target, m.coins
  loop
    if row.progress >= row.target then
      update public.arena_mission_progress set done = true
       where player_id = pid and day = p_day and slot = row.slot;
      perform public.arena_grant(pid, row.coins, 'mission', p_day::text || ':' || row.slot, p_day);
    end if;
  end loop;
  if (select count(*) from public.arena_mission_progress where player_id = pid and day = p_day and done) = 3
     and not (select bonus from public.arena_mission_days where player_id = pid and day = p_day) then
    update public.arena_mission_days set bonus = true where player_id = pid and day = p_day;
    perform public.arena_grant(pid, 50, 'missions-bonus', p_day::text, p_day);
    streak := public.arena_mission_streak(pid, p_day);
    if streak > 0 and streak % 7 = 0 then
      perform public.arena_grant(pid, 300, 'streak', p_day::text, p_day);
    end if;
  end if;
end; $$;

-- The game server's report of a finished match or raid: coins (with daily
-- caps), missions, Mythic Trial wins and Awakening, once per receipt id.
create or replace function public.arena_record_activity(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  pl jsonb; pid uuid; inserted integer;
  kind text = p->>'kind';
  rid text = p->>'id';
  d date = (p->>'day')::date;
  ch text; won boolean; people boolean; active numeric; raid jsonb;
  cleared boolean; peril integer; v_skin text;
begin
  if kind not in ('match', 'raid') or rid is null or d is null
     or jsonb_typeof(p->'players') <> 'array' or jsonb_array_length(p->'players') not between 1 and 4
     or d not between public.arena_today() - 1 and public.arena_today() + 1 then
    raise exception 'Invalid activity';
  end if;
  insert into public.arena_activity(id, kind, day) values (rid, kind, d) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  for pl in select * from jsonb_array_elements(p->'players') loop
    pid = (pl->>'accountId')::uuid;
    if not exists (select 1 from public.arena_profiles where id = pid) then continue; end if;
    ch = pl->>'character';
    won = coalesce((pl->>'won')::boolean, false);
    people = coalesce((pl->>'vsPeople')::boolean, false);
    active = coalesce((pl->>'activeSeconds')::numeric, 0);
    raid = pl->'raid';
    cleared = kind = 'raid' and coalesce((raid->>'cleared')::boolean, false);
    peril = least(3, greatest(1, coalesce((raid->>'peril')::integer, 1)));
    perform public.arena_ensure_missions(pid, d);
    perform public.arena_mission_bump(pid, d, 'skill-uses', least(500, greatest(0, coalesce((pl->>'skillUses')::integer, 0))), ch);
    perform public.arena_mission_bump(pid, d, 'ults', least(50, greatest(0, coalesce((pl->>'ults')::integer, 0))), ch);
    if kind = 'match' and active >= 20 then
      if people and (select count(*) from public.arena_coin_ledger
                      where player_id = pid and day = d and reason = 'pvp') < 10 then
        perform public.arena_grant(pid, case when won then 15 else 6 end, 'pvp', rid, d);
      end if;
      perform public.arena_mission_bump(pid, d, 'play', 1, ch);
      if won then
        if people then perform public.arena_mission_bump(pid, d, 'pvp-wins', 1, ch); end if;
        if pl->>'botLevel' = 'hard' then perform public.arena_mission_bump(pid, d, 'hard-bot-win', 1, ch); end if;
        perform public.arena_mission_bump(pid, d, 'wins-with', 1, ch);
        if pl->>'mode' = 'teams' and not coalesce((pl->>'knockedOut')::boolean, true) then
          perform public.arena_mission_bump(pid, d, 'teams-unharmed', 1, ch);
        end if;
      end if;
    end if;
    if kind = 'raid' then
      perform public.arena_mission_bump(pid, d, 'revives', least(100, greatest(0, coalesce((raid->>'revives')::integer, 0))), ch);
      if cleared then
        if (select count(*) from public.arena_coin_ledger
             where player_id = pid and day = d and reason = 'raid') < 5 then
          perform public.arena_grant(pid, (array[30, 45, 60])[peril], 'raid', rid, d);
        end if;
        perform public.arena_mission_bump(pid, d, 'raid-clear', 1, ch);
        if coalesce((raid->>'daily')::boolean, false) then
          perform public.arena_grant(pid, 50, 'daily-first', d::text, d);
          perform public.arena_mission_bump(pid, d, 'daily-clear', 1, ch);
        end if;
        if peril >= 3 then perform public.arena_mission_bump(pid, d, 'raid-peril3', 1, ch); end if;
        if coalesce((raid->>'flawless')::boolean, false) then perform public.arena_mission_bump(pid, d, 'raid-flawless', 1, ch); end if;
        if coalesce((raid->>'feat')::boolean, false) then perform public.arena_mission_bump(pid, d, 'feat', 1, ch); end if;
      end if;
    end if;
    -- Mythic Trials and Awakening count wins against people and raid clears.
    if (won and people and kind = 'match' and active >= 20) or cleared then
      insert into public.arena_champion_wins(player_id, champion, wins) values (pid, ch, 1)
      on conflict (player_id, champion) do update set wins = public.arena_champion_wins.wins + 1;
      v_skin = pl->>'skin';
      if v_skin is not null and exists (
          select 1 from public.arena_owned_items o join public.arena_shop_items i on i.id = o.item_id
           where o.player_id = pid and o.item_id = v_skin and i.kind = 'champion' and i.champion = ch) then
        insert into public.arena_skin_progress(player_id, skin_id, wins, peril3)
        values (pid, v_skin, 1, cleared and peril >= 3)
        on conflict (player_id, skin_id) do update
          set wins = public.arena_skin_progress.wins + 1,
              peril3 = public.arena_skin_progress.peril3 or excluded.peril3;
      end if;
    end if;
  end loop;
end; $$;
revoke all on function public.arena_record_activity(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

-- Awakening stage from progress (Mythicals).
create or replace function public.arena_awakening(p_wins integer, p_peril3 boolean) returns integer
language sql immutable set search_path = public as $$
  select case when p_wins >= 75 and p_peril3 then 3 when p_wins >= 25 then 2 else 1 end
$$;

-- What an item costs this player today (null: can't be bought).
create or replace function public.arena_item_price(pid uuid, p_item text, p_day date) returns integer
language plpgsql stable security definer set search_path = public as $$
declare item public.arena_shop_items; price integer;
begin
  select * into item from public.arena_shop_items where id = p_item and active;
  if not found then return null; end if;
  if item.kind = 'bundle' then
    select sum(i.price) into price from public.arena_shop_items i
     where i.id = any(item.items) and i.active
       and not exists (select 1 from public.arena_owned_items o where o.player_id = pid and o.item_id = i.id);
    if price is null then return null; end if;
    return (round(price * 0.8 / 10) * 10)::integer;
  end if;
  if exists (select 1 from public.arena_owned_items where player_id = pid and item_id = p_item) then return null; end if;
  if exists (select 1 from public.arena_shop_picks(p_day) where item_id = p_item and deal) then
    return (round(item.price * 0.8 / 10) * 10)::integer;
  end if;
  return item.price;
end; $$;
revoke all on function public.arena_item_price(uuid, text, date) from public, anon, authenticated, service_role;
revoke all on function public.arena_grant(uuid, integer, text, text, date) from public, anon, authenticated, service_role;
revoke all on function public.arena_mission_bump(uuid, date, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.arena_ensure_missions(uuid, date) from public, anon, authenticated, service_role;

-- The caller's shop state: balance, owned, picks, trials, missions, looks.
create or replace function public.arena_economy() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today();
begin
  if me is null then raise exception 'Login required'; end if;
  perform public.arena_ensure_missions(me, d);
  return jsonb_build_object(
    'balance', coalesce((select balance from public.arena_wallets where player_id = me), 0),
    'owned', coalesce((select jsonb_agg(item_id order by item_id) from public.arena_owned_items where player_id = me), '[]'::jsonb),
    'picks', jsonb_build_object('day', d,
      'items', coalesce((select jsonb_agg(item_id) from public.arena_shop_picks(d)), '[]'::jsonb),
      'deal', (select item_id from public.arena_shop_picks(d) where deal)),
    'trialWins', coalesce((select jsonb_object_agg(champion, wins) from public.arena_champion_wins where player_id = me), '{}'::jsonb),
    'awakening', coalesce((select jsonb_object_agg(i.id, jsonb_build_object(
        'wins', coalesce(sp.wins, 0), 'peril3', coalesce(sp.peril3, false),
        'stage', public.arena_awakening(coalesce(sp.wins, 0), coalesce(sp.peril3, false))))
      from public.arena_owned_items o join public.arena_shop_items i on i.id = o.item_id
      left join public.arena_skin_progress sp on sp.player_id = me and sp.skin_id = i.id
      where o.player_id = me and i.rarity = 'mythical'), '{}'::jsonb),
    'looks', coalesce((select jsonb_object_agg(champion, jsonb_build_object('skin', skin, 'stage', stage))
      from public.arena_champion_looks where player_id = me), '{}'::jsonb),
    'missions', coalesce((select jsonb_agg(jsonb_build_object('day', mp.day, 'slot', mp.slot, 'id', m.id,
        'text', m.text, 'tier', m.tier, 'progress', mp.progress, 'target', m.target,
        'coins', m.coins, 'done', mp.done) order by mp.slot)
      from public.arena_mission_progress mp join public.arena_missions m on m.id = mp.mission_id
      where mp.player_id = me and mp.day = d), '[]'::jsonb),
    'rerolled', coalesce((select rerolled from public.arena_mission_days where player_id = me and day = d), false),
    'streak', public.arena_mission_streak(me, d),
    'today', jsonb_build_object(
      'raidClears', (select count(*) from public.arena_coin_ledger where player_id = me and day = d and reason = 'raid'),
      'pvpMatches', (select count(*) from public.arena_coin_ledger where player_id = me and day = d and reason = 'pvp')));
end; $$;
revoke all on function public.arena_economy() from public, anon;
grant execute on function public.arena_economy() to authenticated;

-- Buy an item (a bundle buys every piece not yet owned).
create or replace function public.arena_buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); item public.arena_shop_items; price integer; paid integer;
begin
  if me is null then raise exception 'Login required'; end if;
  if not exists (select 1 from public.arena_profiles where id = me and not suspended) then raise exception 'Login required'; end if;
  select * into item from public.arena_shop_items where id = p_item and active;
  if not found then raise exception 'That item is not for sale'; end if;
  if item.rarity = 'mythical' and coalesce((select wins from public.arena_champion_wins
       where player_id = me and champion = item.champion), 0) < 30 then
    raise exception 'Mythic Trial: win 30 matches or raids with this champion first';
  end if;
  price = public.arena_item_price(me, p_item, d);
  if price is null then raise exception 'You already own this'; end if;
  insert into public.arena_wallets(player_id) values (me) on conflict do nothing;
  update public.arena_wallets set balance = balance - price where player_id = me and balance >= price;
  get diagnostics paid = row_count;
  if paid = 0 then raise exception 'Not enough coins'; end if;
  insert into public.arena_coin_ledger(player_id, amount, reason, ref, day)
  values (me, -price, 'buy', p_item || ':' || gen_random_uuid(), d);
  insert into public.arena_owned_items(player_id, item_id)
  select me, x from unnest(case when item.kind = 'bundle' then item.items else array[item.id] end) x
  on conflict do nothing;
  return public.arena_economy();
end; $$;
revoke all on function public.arena_buy_item(text) from public, anon;
grant execute on function public.arena_buy_item(text) to authenticated;

-- Wear a champion skin (null: the champion's own look), at a reached stage.
create or replace function public.arena_equip_champion_skin(p_champion text, p_skin text, p_stage integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); item public.arena_shop_items; reached integer = 1;
begin
  if me is null then raise exception 'Login required'; end if;
  if p_skin is null then
    delete from public.arena_champion_looks where player_id = me and champion = p_champion;
    return public.arena_economy();
  end if;
  select * into item from public.arena_shop_items where id = p_skin and kind = 'champion';
  if not found or item.champion <> p_champion then raise exception 'That skin is for another champion'; end if;
  if not exists (select 1 from public.arena_owned_items where player_id = me and item_id = p_skin) then
    raise exception 'You do not own that skin';
  end if;
  if item.rarity = 'mythical' then
    select public.arena_awakening(coalesce(wins, 0), coalesce(peril3, false)) into reached
      from public.arena_skin_progress where player_id = me and skin_id = p_skin;
    reached = coalesce(reached, 1);
  end if;
  if coalesce(p_stage, 1) not between 1 and reached then raise exception 'That Awakening stage is not unlocked yet'; end if;
  insert into public.arena_champion_looks(player_id, champion, skin, stage)
  values (me, p_champion, p_skin, coalesce(p_stage, 1))
  on conflict (player_id, champion) do update set skin = excluded.skin, stage = excluded.stage;
  return public.arena_economy();
end; $$;
revoke all on function public.arena_equip_champion_skin(text, text, integer) from public, anon;
grant execute on function public.arena_equip_champion_skin(text, text, integer) to authenticated;

-- One free re-roll a day: swap one mission for the next one in its tier.
create or replace function public.arena_reroll_mission(p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); tier text; next_id text;
begin
  if me is null then raise exception 'Login required'; end if;
  perform public.arena_ensure_missions(me, d);
  if (select rerolled from public.arena_mission_days where player_id = me and day = d) then
    raise exception 'You already re-rolled a mission today';
  end if;
  if exists (select 1 from public.arena_mission_progress where player_id = me and day = d and slot = p_slot and done) then
    raise exception 'That mission is already done';
  end if;
  tier = (array['easy', 'medium', 'hard'])[p_slot + 1];
  if tier is null then raise exception 'Unknown mission'; end if;
  next_id = public.arena_daily_mission(d, tier, 1);
  if next_id is null then raise exception 'No other mission today'; end if;
  update public.arena_mission_progress set mission_id = next_id, progress = 0
   where player_id = me and day = d and slot = p_slot;
  update public.arena_mission_days set rerolled = true where player_id = me and day = d;
  return public.arena_economy();
end; $$;
revoke all on function public.arena_reroll_mission(integer) from public, anon;
grant execute on function public.arena_reroll_mission(integer) to authenticated;

-- What the game server shows of a player: equipped champion skins.
create or replace function public.arena_my_looks() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_object_agg(champion, jsonb_build_object('skin', skin, 'stage', stage))
    from public.arena_champion_looks where player_id = auth.uid()), '{}'::jsonb)
$$;
revoke all on function public.arena_my_looks() from public, anon;
grant execute on function public.arena_my_looks() to authenticated;

-- Appearance slots accept collection pieces you own, as well as raid rewards.
create or replace function public.arena_equip_raid_slot(p_slot text, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null then raise exception 'Login required'; end if;
  if p_slot not in ('skin', 'aura', 'entrance', 'frame', 'victory') then raise exception 'Unknown slot'; end if;
  if p_item is not null then
    if exists (select 1 from public.arena_shop_items i where i.id = p_item and i.kind = 'look') then
      if not exists (select 1 from public.arena_shop_items i where i.id = p_item and i.slot = p_slot) then
        raise exception 'That item belongs in another slot';
      end if;
      if not exists (select 1 from public.arena_owned_items o where o.player_id = me and o.item_id = p_item) then
        raise exception 'Cosmetic not earned';
      end if;
    else
      if not exists (select 1 from public.arena_raid_rewards w where w.id = p_item and w.slot = p_slot) then
        raise exception 'That item belongs in another slot';
      end if;
      if not exists (select 1 from public.arena_raid_earned(me) e where e = p_item) then
        raise exception 'Cosmetic not earned';
      end if;
    end if;
  end if;
  insert into public.arena_raid_loadouts(player_id) values (me) on conflict (player_id) do nothing;
  update public.arena_raid_loadouts set
    skin = case when p_slot = 'skin' then p_item else skin end,
    aura = case when p_slot = 'aura' then p_item else aura end,
    entrance = case when p_slot = 'entrance' then p_item else entrance end,
    frame = case when p_slot = 'frame' then p_item else frame end,
    victory = case when p_slot = 'victory' then p_item else victory end,
    cosmetic = null
  where player_id = me;
end; $$;
revoke all on function public.arena_equip_raid_slot(text, text) from public, anon;
grant execute on function public.arena_equip_raid_slot(text, text) to authenticated;
commit;
