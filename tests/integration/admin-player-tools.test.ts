import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Admin player tools (migration 20261122100000): a player's status for the
// Admin panel, and adding or taking coins with an audit trail.
let db: PGlite;
const nova = "00000000-0000-4000-8000-0000000022a1";
const ana = "00000000-0000-4000-8000-0000000022a2";
const admin = "00000000-0000-4000-8000-0000000022a3";
const ref = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
const status = async (id: string) => {
  await as(admin);
  const r = await db.query<{ s: any }>(
    "select public.arena_admin_player_status($1) as s",
    [id],
  );
  return r.rows[0].s;
};
const adjust = async (
  id: string,
  amount: number,
  reason: string,
  n: number,
) => {
  await as(admin);
  const r = await db.query<{ s: any }>(
    "select public.arena_admin_adjust_coins($1, $2, $3, $4) as s",
    [id, amount, reason, ref(n)],
  );
  return r.rows[0].s;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `reset role;insert into auth.users values('${nova}','{"display_name":"Nova"}'),('${ana}','{"display_name":"Ana"}'),('${admin}','{"display_name":"Boss"}')`,
  );
  for (const id of [nova, ana, admin]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}')`,
  );
}, 120000);
afterAll(async () => db.close());

it("shows a player's coins and chat stop", async () => {
  let s = await status(nova);
  expect(s.balance).toBe(0);
  expect(s.chatUntil).toBeNull();
  expect(s.coins).toEqual([]);
  await as(admin);
  await db.query("select public.arena_admin_chat_ban($1, 24, 'Insults')", [
    nova,
  ]);
  s = await status(nova);
  expect(s.chatReason).toBe("Insults");
  const hours = (Date.parse(s.chatUntil) - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(23.9);
  // Lifted: no longer shown.
  await as(admin);
  await db.query("select public.arena_admin_chat_ban($1, 0, null)", [nova]);
  expect((await status(nova)).chatUntil).toBeNull();
});

it("adds and takes coins, never below 0, once per request", async () => {
  expect(await adjust(nova, 500, "Raid bug refund", 1)).toEqual({
    applied: 500,
    balance: 500,
  });
  // The same request again changes nothing.
  expect(await adjust(nova, 500, "Raid bug refund", 1)).toEqual({
    applied: 0,
    balance: 500,
  });
  expect(await adjust(nova, -200, "Duplicate refund", 2)).toEqual({
    applied: -200,
    balance: 300,
  });
  // Taking more than they have stops at 0.
  expect(await adjust(nova, -1000, "Exploit clean-up", 3)).toEqual({
    applied: -300,
    balance: 0,
  });
  expect(await adjust(nova, -10, "Nothing left", 4)).toEqual({
    applied: 0,
    balance: 0,
  });
  const s = await status(nova);
  expect(s.coins.map((c: any) => c.amount)).toEqual([-300, -200, 500]);
  expect(s.coins[0].reason).toBe("admin");
  // Every change is audited with who and why.
  await db.exec("reset role");
  const audit = await db.query<{ actor_id: string; details: any }>(
    "select actor_id, details from public.arena_admin_audit where action = 'adjust_coins' and target_id = $1 order by id",
    [nova],
  );
  expect(audit.rows).toHaveLength(3);
  expect(audit.rows[0].actor_id).toBe(admin);
  expect(audit.rows[2].details).toMatchObject({
    asked: -1000,
    applied: -300,
    reason: "Exploit clean-up",
  });
});

it("refuses players who aren't admins and bad requests", async () => {
  await as(ana);
  await expect(
    db.query("select public.arena_admin_adjust_coins($1, 100, 'gift', $2)", [
      ana,
      ref(9),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_admin_player_status($1)", [nova]),
  ).rejects.toThrow();
  await expect(adjust(nova, 0, "zero", 10)).rejects.toThrow("Choose an amount");
  await expect(adjust(nova, 100001, "too much", 11)).rejects.toThrow(
    "Choose an amount",
  );
  await expect(adjust(nova, 10, "x", 12)).rejects.toThrow("Say why");
  await expect(
    adjust("00000000-0000-4000-8000-0000000022ff", 10, "nobody", 13),
  ).rejects.toThrow("Player not found");
  // Nothing moved.
  expect((await status(ana)).balance).toBe(0);
});
