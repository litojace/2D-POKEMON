-- Faster milk, to match the faster crops (062): the cow gives Storm Milk
-- every 2 hours (was 5 h 20 m), and the first milk comes 20 minutes after
-- the pasture opens (was 80). A cow already grazing is ready by then too.
-- Run after 063_farm_cup_removed.sql. Safe to run again.
begin;

-- As in 050_farm_giants.sql, with the shorter milk times.
create or replace function public.arena_farm_act_extra(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; n integer; cost integer; used integer;
begin
  xp = 0;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'harvest-giant' then
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_harvest_giant(pid,
        case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer end, t) x;
  elsif a->>'a' = 'buy-pasture' then
    if f.pasture then err = 'You already have the pasture';
    elsif f.level < 9 then err = 'Unlocks at farm level 9';
    elsif not public.arena_spend_leaves(pid, 900, 'farm-pasture', 'pasture', d) then
      err = 'Not enough Gold Leaves';
    else
      update public.arena_farms set pasture = true, milk_at = t + interval '20 minutes' where player_id = pid;
      gained = jsonb_build_object('pasture', true, 'milkAt', t + interval '20 minutes');
      xp = 30;
    end if;
  elsif a->>'a' = 'milk' then
    if not f.pasture then err = 'Open the pasture first';
    elsif f.milk_at > t then err = 'The cow is still grazing';
    elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid) + 2
        > 80 + 40 * f.barn_upgrades then
      err = 'Your barn is full';
    else
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, 'milk', '', 2)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 2;
      update public.arena_farms set milk_at = t + interval '2 hours' where player_id = pid;
      gained = jsonb_build_object('milk', 2, 'milkAt', t + interval '2 hours');
      xp = 8;
    end if;
  elsif a->>'a' = 'sell-milk' then
    n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer end;
    if n is null or n < 1 or n > 10000 then err = 'Choose how many to sell';
    else
      update public.arena_farm_barn set qty = qty - n
       where player_id = pid and crop = 'milk' and mutation = '' and qty >= n;
      get diagnostics used = row_count;
      if used = 0 then err = 'You don''t have that many';
      else
        cost = greatest(1, round(60 * public.arena_farm_milk_mult(d)))::integer * n;
        perform public.arena_grant_leaves(pid, cost, 'farm-sell', ref, d);
        gained = jsonb_build_object('leaves', cost);
      end if;
    end if;
  else
    err = 'Unknown action';
  end if;
end; $$;

update public.arena_farms set milk_at = now() + interval '2 hours'
 where pasture and milk_at > now() + interval '2 hours';

commit;
