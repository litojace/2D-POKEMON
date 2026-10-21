// Web Crypto keeps the exact expedition simulation usable in the visual lab.
const randomUUID = () => crypto.randomUUID();
import { createRaidArena } from "./raid-bosses.js";
import type { RaidArena } from "./raid.js";
import {
  CHARACTERS,
  blankInput,
  type Fighter,
} from "../../../packages/shared/src/index.js";
import {
  expeditionRoute,
  type CampChoice,
  type ExpeditionCarry,
  type ExpeditionState,
} from "../../../packages/shared/src/expedition.js";
import type { ActivityReceipt } from "../../../packages/shared/src/shop.js";
interface Runtime {
  carry: Record<string, ExpeditionCarry>;
  stats: Record<string, { skills: number; ults: number; engaged: boolean }>;
  captured: number;
}
const runs = new WeakMap<RaidArena, Runtime>();
function copyParty(from: RaidArena, to: RaidArena) {
  for (const p of from.heroes()) {
    const q = to.add(p.id, p.name, p.character);
    Object.assign(q, {
      connected: p.connected,
      title: p.title,
      titleColor: p.titleColor,
      raidLook: p.raidLook,
      championLooks: p.championLooks,
      ready: false,
    });
  }
  for (const [id, brain] of from.bots)
    if (to.heroes().some((p) => p.id === id)) to.bots.set(id, brain);
  to.raid.standIns = [...(from.raid.standIns ?? [])];
}
export function createExpedition(code: string, day: string) {
  const route = expeditionRoute(day),
    a = createRaidArena(code, route[0]);
  a.raid.expedition = {
    id: randomUUID(),
    day,
    route,
    leg: 0,
    completed: 0,
    elapsed: 0,
    downs: 0,
    revives: 0,
    camp: false,
    choices: {},
  };
  runs.set(a, { carry: {}, stats: {}, captured: -1 });
  return a;
}
/** Called after the concrete boss's start() has installed all of its mechanics. */
export function prepareExpedition(a: RaidArena) {
  if (!a.raid.expedition) return;
  const runtime = runs.get(a)!;
  a.prepareExpeditionStage(runtime.carry);
  for (const id of a.bots.keys())
    if (!a.instructionsReady.includes(id)) a.instructionsReady.push(id);
}
function capture(a: RaidArena, won: boolean) {
  const e = a.raid.expedition!,
    rt = runs.get(a)!;
  if (rt.captured === e.leg) return;
  rt.captured = e.leg;
  e.elapsed += a.raid.elapsed;
  e.downs += a.raid.downs;
  e.revives += a.raid.revives;
  if (won) e.completed = e.leg + 1;
  for (const p of a.heroes()) {
    const c = a.raid.contributions?.[p.id];
    const sums = (e.contributions ??= {});
    const prior = sums[p.id] ?? { damage: 0, revives: 0, downs: 0 };
    sums[p.id] = {
      damage: prior.damage + (c?.damage ?? 0),
      revives: prior.revives + (c?.revives ?? 0),
      downs: prior.downs + (c?.downs ?? 0),
    };
    const previous = rt.stats[p.id] ?? { skills: 0, ults: 0, engaged: false };
    rt.stats[p.id] = {
      skills: previous.skills + p.stats.skills,
      ults: previous.ults + (p.stats.ults ?? 0),
      engaged:
        previous.engaged ||
        a.engaged.has(p.id) ||
        p.stats.skills > 0 ||
        p.stats.dealt > 0,
    };
    rt.carry[p.id] = {
      hp: Math.max(0, p.hp),
      ult: p.ult ?? 0,
      rites: [...(a.raid.rites[p.id] ?? [])],
    };
  }
}
/** The server converts intermediate victories into a camp before broadcasting. */
export function enterExpeditionCamp(a: RaidArena) {
  const e = a.raid.expedition;
  if (!e || a.raid.result !== "victory" || e.leg >= e.route.length - 1)
    return false;
  capture(a, true);
  e.camp = true;
  e.choices = {};
  a.beginExpeditionCamp();
  for (const id of a.bots.keys()) e.choices[id] = "rest";
  return true;
}
export function chooseExpeditionCamp(
  a: RaidArena,
  id: string,
  choice: CampChoice,
) {
  const e = a.raid.expedition;
  if (
    !e?.camp ||
    a.phase !== "intermission" ||
    a.time >= a.deadline ||
    !a.heroes().some((p) => p.id === id) ||
    e.choices[id]
  )
    return false;
  e.choices[id] = choice;
  if (a.heroes().every((p) => e.choices[p.id]))
    a.deadline = Math.min(a.deadline, a.time + 1);
  return true;
}
export function advanceExpedition(a: RaidArena) {
  const e = a.raid.expedition;
  if (!e?.camp || a.phase !== "intermission" || a.time < a.deadline) return;
  const rt = runs.get(a)!;
  for (const p of a.heroes()) {
    const carry = rt.carry[p.id],
      full = CHARACTERS[p.character].health;
    if ((e.choices[p.id] ?? "rest") === "rest") carry.hp = full;
    else {
      carry.hp = Math.min(full, Math.max(1, carry.hp) + full * 0.35);
      carry.ult = Math.min(100, carry.ult + 40);
    }
  }
  e.leg++;
  e.camp = false;
  e.choices = {};
  const next = createRaidArena(a.code, e.route[e.leg]);
  copyParty(a, next);
  next.raid.expedition = e;
  runs.set(next, rt);
  next.start();
  prepareExpedition(next);
  return next;
}
export function restartExpedition(a: RaidArena, day: string, start: boolean) {
  const next = createExpedition(a.code, day);
  copyParty(a, next);
  if (start) {
    next.start();
    prepareExpedition(next);
  }
  return next;
}
export function expeditionReceipt(
  a: RaidArena,
  owners: Map<string, string> | undefined,
): ActivityReceipt | undefined {
  const e = a.raid.expedition;
  if (!e || !a.raid.result || e.saved) return;
  capture(a, a.raid.result === "victory");
  e.saved = "saving";
  const rt = runs.get(a)!;
  return {
    id: `expedition:${e.id}`,
    kind: "expedition",
    day: e.day,
    players: a
      .heroes()
      .filter((p) => owners?.get(p.id))
      .map((p) => ({
        accountId: owners!.get(p.id)!,
        character: p.character,
        won: e.completed === 3,
        vsPeople: false,
        botLevel: null,
        mode: "raid",
        knockedOut: e.downs > 0,
        skillUses: rt.stats[p.id]?.skills ?? 0,
        ults: rt.stats[p.id]?.ults ?? 0,
        participated: rt.stats[p.id]?.engaged ?? false,
        activeSeconds: e.elapsed,
        abandoned: p.out,
        expedition: { completed: e.completed },
      })),
  };
}
