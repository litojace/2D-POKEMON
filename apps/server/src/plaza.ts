import {
  PLAZA_FIGHT,
  plazaFightMovesOk,
  plazaFightReplay,
  type PlazaFightRarity,
} from "../../../packages/shared/src/plaza-fight.js";
import {
  LapTimer,
  ORB_SHOWER,
  PLAZA,
  PLAZA_CAFE,
  PLAZA_CHEER_SECONDS,
  PLAZA_EMOTES,
  PLAZA_FISHING,
  PLAZA_FLAG,
  PLAZA_GATE,
  PLAZA_GIFT,
  PLAZA_HURDLES,
  PLAZA_PAIR,
  PLAZA_PAIR_EMOTES,
  PLAZA_PHOTO,
  PLAZA_PITCH,
  PLAZA_SPAWN,
  PLAZA_SQUARE,
  inPitch,
  onRunway,
  orbHeight,
  orbShower,
  plazaBallStart,
  plazaBallStep,
  plazaBody,
  plazaCollide,
  plazaDash,
  plazaFishPick,
  PLAZA_FISH_BY_ID,
  plazaIsNight,
  plazaJump,
  plazaSpotAt,
  plazaStep,
  plazaStick,
  plazaTimeOfDay,
  onTrack,
  trackPoint,
  trackPolar,
  type PlazaBall,
  type PlazaBody,
  type PlazaEmote,
  type PlazaFishNote,
  type PlazaNews,
  type PlazaOrb,
  type PlazaGift,
  type PlazaGiftGone,
  type PlazaOrbs,
  type PlazaPairAsk,
  type PlazaPairStart,
  type PlazaProfile,
  type PlazaSpotId,
  type PlazaState,
  type PlazaWalker,
} from "../../../packages/shared/src/plaza.js";

/**
 * The new Plaza (hub redesign phase 3): who is where, the pitch bots, the
 * ball, the Orb Shower, lap times and runway cheers. Pure state (no sockets),
 * so it can be tested directly; server.ts wires it to connections, and
 * the database records quests (paid in coins) for what `step` reports.
 */
interface Visitor {
  key: string;
  accountId: string;
  plaza: number;
  body: PlazaBody;
  dir: { x: number; y: number };
  /** Timed sticks, dashes and jumps waiting for their moment (PlazaInput). */
  queue: PlazaInput[];
  /** A timed message plays at its browser time plus `lead` (step ms minus
   * browser ms): the latest arrival lately, from `seen` (arrival, lag). */
  lead: number | null;
  seen: [number, number][];
  /** The newest message number applied (PlazaState.ack), and when (step ms). */
  ack: number;
  ackAt: number;
  emote: number;
  emoteUntil: number;
  lastEmote: number;
  /** The emote is a pair emote (PLAZA_FLAG.pair). */
  pair: boolean;
  /** A pair request waiting for this visitor's answer. */
  invite: { from: string; kind: number; until: number } | null;
  /** When this visitor last asked someone for a pair emote (ms). */
  lastAsk: number;
  /** When this visitor last tossed a gift box (ms). */
  lastTreat: number;
  lap: LapTimer;
  /** Runway: seconds until the next cheer, cheers so far, last runway news. */
  cheerIn: number;
  cheers: number;
  /** Cheers this visit, for the runway card. */
  claps: number;
  onRunway: boolean;
  runwayNewsAt: number;
  /** Orbs caught per shower (only the first few pay). */
  orbs: Map<string, number>;
  /** A fishing line in the pond, and when the next cast may go (ms). */
  line: FishingLine | null;
  nextCast: number;
  profile: PlazaProfile;
  version: number;
}
/**
 * A dash a little before the cooldown ends still goes (seconds): the
 * browser's dashes reach the server unevenly spaced, and refusing one the
 * browser already showed puts the server's copy 120 px behind.
 */
const PLAZA_DASH_SLACK = 0.1;
/** Timed inputs: at most `holdMs` behind their arrival and `queue` waiting.
 * The lead rises at once to cover a late arrival and falls back, at most
 * `leadDecay` ms a second, once none in the last `windowMs` was that late. */
export const PLAZA_INPUT = {
  holdMs: 400,
  queue: 64,
  windowMs: 2000,
  leadDecay: 50,
} as const;
/** How the browser numbers (`s`) and times (`t`, its own ms clock) an input. */
export interface PlazaTiming {
  s?: unknown;
  t?: unknown;
}
interface PlazaInput {
  kind: "stick" | "jump" | "dash";
  x: number;
  y: number;
  seq: number;
  /** When it plays, on the step clock (ms). */
  at: number;
}
/** A line in the pond: the fish (secret until caught) and when it bites. */
interface FishingLine {
  fish: string;
  biteAt: number;
  /** When it bit (ms), once it has. */
  bitAt: number | null;
  /** Hooked (reeled in time): when, and the fight's seed (plaza-fight.ts). */
  hookedAt: number | null;
  seed: number;
}
/** A reel in time hooks the fish: the fight to land it starts (the fish
 * itself stays secret; its rarity sets how it fights). */
export type PlazaReel =
  | { ok: true; hooked: true; rarity: PlazaFightRarity; seed: number }
  | { ok: false; error: string; why?: "early" | "late" };
/** The fight's end: the fish, or why it got away. */
export type PlazaLand =
  | { ok: true; fish: string }
  | { ok: false; error: string; why?: "snap" | "escape" | "bad" };
/** How much sooner than its own length a fight may end (network, ms). */
const FIGHT_SLACK_MS = 600;
/** Where a pitch bot's teammate waits while the other chases the ball. */
const BOT_SUPPORT = { back: 120, wide: 110, tie: 24 } as const;
const clampTo = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
/** Push bodies that overlap apart, half each, then out of any wall. */
export function separateBodies(bodies: PlazaBody[]) {
  const min = PLAZA.radius * 2 + 4;
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i],
        b = bodies[j];
      let dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.01) {
        // Exactly on top: part them sideways.
        dx = 1;
        dy = 0;
        d = 1;
      }
      const push = (min - Math.max(d, 0.01)) / 2;
      a.x -= (dx / d) * push;
      a.y -= (dy / d) * push;
      b.x += (dx / d) * push;
      b.y += (dy / d) * push;
      plazaCollide(a);
      plazaCollide(b);
    }
}
interface Bot {
  key: string;
  team: 0 | 1;
  body: PlazaBody;
  profile: PlazaProfile;
}
/** What a townsperson does all day (the prototype's NPC brains). */
type FolkAi = "wander" | "runway" | "track" | "dance" | "cafe" | "photo";
interface Folk {
  /** Which of TOWNSFOLK this is. */
  index: number;
  ai: FolkAi;
  body: PlazaBody;
  profile: PlazaProfile;
  /** Where they're walking to, and seconds to stand still first. */
  tx: number | null;
  ty: number;
  wait: number;
  /** Runway step, or angle round the track. */
  step: number;
  angle: number;
  emote: number;
  emoteUntil: number;
  /** Walking out of the gate to make room for players. */
  leaving: boolean;
  /** Seconds spent pushing against something without getting anywhere. */
  stuck: number;
}
interface Copy {
  id: number;
  ball: PlazaBall;
  last: { key?: string };
  score: [number, number];
  bots: Bot[];
  folk: Folk[];
  shower: string | null;
  orbs: Map<number, { id: number; x: number; y: number; at: number }>;
  nextOrbAt: number;
  /** Gift boxes tossed here, until their orbs are caught or fade. */
  gifts: Map<number, CopyGift>;
  /** When its last player left: it waits, paused, for PLAZA_RETURN_MS. */
  emptySince: number | null;
}
/** A gift box in a copy: the thrower's key (who can't catch its orbs) and
 * the orbs still lying there. */
interface CopyGift {
  gift: Omit<PlazaGift, "orbs">;
  byKey: string;
  orbs: Map<number, { x: number; y: number }>;
}
/** What happened this step, for server.ts to pay and announce. */
export type PlazaEvent =
  | { type: "orb"; key: string; ref: string }
  | { type: "goal"; key: string }
  | { type: "lap"; key: string; ms: number }
  | { type: "cheers"; key: string; n: number }
  | { type: "fish"; key: string; note: PlazaFishNote }
  | { type: "news"; plaza: number; news: PlazaNews }
  | { type: "orbs"; plaza: number; orbs: PlazaOrbs }
  | { type: "giftGone"; plaza: number; gone: PlazaGiftGone };

/** The pitch bots, blue side then red, named as the townsfolk are: a role,
 * not "Blue Bot" or "Red Bot" ("Red Bot scored a goal" read as a test). */
export const PITCH_BOTS = [
  ["Striker", "voltkit"],
  ["Winger", "tidefin"],
  ["Captain", "cindrake"],
  ["Playmaker", "duskveil"],
] as const;

/**
 * Townsfolk: NPCs who keep a quiet Plaza lively, as in the approved
 * prototype (docs/hub-redesign/prototype/app/plaza.js). They are marked as
 * bots (role names, not player names; no card, no Add friend), wear Shop
 * skins (Rare and Epic only: Legendary and Mythical skins are what players
 * earn, owner 22 Nov), and step aside as players arrive. They never count for anything:
 * no population, laps, cheers, orbs, goals, gift boxes or news.
 */
export const TOWNSFOLK: readonly {
  name: string;
  character: string;
  skin: { skin: string; stage: number } | null;
  ai: FolkAi;
  /** Runway: which side of the catwalk they come and go (-1 left, 1 right). */
  side?: -1 | 1;
  /** Track: their lane (0 inner, 1 outer) and pace (radians a second). */
  lane?: number;
  pace?: number;
}[] = [
  {
    name: "Stroller",
    character: "mystowl",
    skin: { skin: "mystowl-clockwork", stage: 1 },
    ai: "wander",
  },
  {
    name: "Runway Model",
    character: "lumoth",
    skin: { skin: "lumoth-aurora", stage: 1 },
    ai: "runway",
    side: -1,
  },
  {
    name: "Jogger",
    character: "terradon",
    skin: { skin: "terradon-geode", stage: 1 },
    ai: "track",
    lane: 0.3,
    pace: 0.62,
  },
  {
    name: "Dancer",
    character: "voltkit",
    skin: { skin: "voltkit-neon-arcade", stage: 1 },
    ai: "dance",
  },
  {
    name: "Café Regular",
    character: "lumoth",
    skin: { skin: "lumoth-rosy-maple", stage: 1 },
    ai: "cafe",
  },
  {
    name: "Photographer",
    character: "halcyra",
    skin: { skin: "halcyra-paper-crane", stage: 1 },
    ai: "photo",
  },
  {
    name: "Sightseer",
    character: "pyranda",
    skin: { skin: "pyranda-street-vendor", stage: 1 },
    ai: "wander",
  },
  {
    name: "Runway Model",
    character: "tidefin",
    skin: { skin: "tidefin-glacier", stage: 1 },
    ai: "runway",
    side: 1,
  },
  {
    name: "Sprinter",
    character: "auralynx",
    skin: { skin: "auralynx-stained-glass", stage: 1 },
    ai: "track",
    lane: 0.72,
    pace: 0.52,
  },
];
/** Townsfolk in a copy: all of them for one player, one fewer for each more. */
export const townsfolkFor = (players: number) =>
  Math.max(0, Math.min(TOWNSFOLK.length, TOWNSFOLK.length - (players - 1)));
/** The runway walk: up the catwalk, pose on the stage, back down. */
const RUNWAY_STEPS = (side: number) =>
  [
    [1350 + side * 170, 680],
    [1350, 640],
    [1350, 590],
    [1350, 470],
    [1350, 395],
    [1350, 470],
    [1350 + side * 170, 690],
  ] as const;
const emoteIndex = (e: (typeof PLAZA_EMOTES)[number]) =>
  PLAZA_EMOTES.indexOf(e) + 1;

/** How long the Plaza keeps your spot after you leave it. */
export const PLAZA_RETURN_MS = 10 * 60_000;
export class PlazaWorld {
  private visitors = new Map<string, Visitor>();
  private copies = new Map<number, Copy>();
  private nextId = 1;
  private nextOrb = 1;
  private nextGift = 1;
  private told = new Map<string, Map<number, number>>();
  private clock = 0;
  /** The real time (ms) players have been moved up to: the last step's
   * `now`. Timed inputs are placed on this clock, and players move through
   * the time that really passed, so a late tick doesn't leave the server's
   * clock behind your browser's (and inputs held longer and longer). */
  private movedTo: number | null = null;
  constructor(
    private random: () => number = Math.random,
    /** The real clock (the same as step's `now`): when a timed input arrived. */
    private realNow: () => number = Date.now,
  ) {}

  get size() {
    return this.visitors.size;
  }
  population(plaza: number) {
    let n = 0;
    for (const v of this.visitors.values()) if (v.plaza === plaza) n++;
    return n;
  }
  plazaOf(key: string) {
    return this.visitors.get(key)?.plaza;
  }
  profileOf(key: string) {
    return this.visitors.get(key)?.profile;
  }
  accountOf(key: string) {
    return this.visitors.get(key)?.accountId;
  }
  /** Everyone in the same copy as this visitor (chat's Nearby channel). */
  mates(key: string) {
    const me = this.visitors.get(key);
    if (!me) return [];
    return [...this.visitors.values()]
      .filter((v) => v.plaza === me.plaza)
      .map((v) => ({
        key: v.key,
        accountId: v.accountId,
        name: v.profile.name,
      }));
  }
  keys() {
    return [...this.visitors.keys()];
  }
  /** Where someone is (tests and the photo). */
  bodyOf(key: string) {
    return this.visitors.get(key)?.body;
  }

  /** Where each account last stood, for PLAZA_RETURN_MS after it left. */
  private lastSpot = new Map<string, { x: number; y: number; at: number }>();
  join(
    key: string,
    accountId: string,
    profile: Omit<PlazaProfile, "id" | "bot">,
    now = Date.now(),
  ) {
    const existing = this.visitors.get(key);
    if (existing) return existing;
    for (const [k, v] of this.visitors)
      if (v.accountId === accountId) this.leave(k, now);
    let plaza = 1;
    while (this.population(plaza) >= PLAZA.capacity) plaza++;
    // Back within a few minutes (a look at the Lobby, a match):
    // you stand where you left; otherwise by the fountain.
    const back = this.lastSpot.get(accountId);
    this.lastSpot.delete(accountId);
    const a = this.random() * Math.PI * 2,
      spot = plazaCollide(
        back && now - back.at < PLAZA_RETURN_MS
          ? { x: back.x, y: back.y }
          : {
              x: PLAZA_SPAWN.x + Math.cos(a) * 70 * this.random(),
              y: PLAZA_SPAWN.y + Math.sin(a) * 30 * this.random(),
            },
      );
    const visitor: Visitor = {
      key,
      accountId,
      plaza,
      body: plazaBody(spot.x, spot.y),
      dir: { x: 0, y: 0 },
      queue: [],
      lead: null,
      seen: [],
      ack: 0,
      ackAt: 0,
      emote: 0,
      emoteUntil: 0,
      lastEmote: -Infinity,
      pair: false,
      invite: null,
      lastAsk: -Infinity,
      lastTreat: -Infinity,
      lap: new LapTimer(),
      cheerIn: PLAZA_CHEER_SECONDS,
      cheers: 0,
      claps: 0,
      onRunway: false,
      runwayNewsAt: -Infinity,
      orbs: new Map(),
      line: null,
      nextCast: -Infinity,
      profile: { ...profile, accountId, id: this.nextId++ },
      version: 1,
    };
    this.visitors.set(key, visitor);
    this.told.set(key, new Map());
    this.copy(plaza, now);
    return visitor;
  }
  leave(key: string, now = Date.now()) {
    const v = this.visitors.get(key);
    this.visitors.delete(key);
    this.told.delete(key);
    if (v) {
      this.lastSpot.set(v.accountId, { x: v.body.x, y: v.body.y, at: now });
      // Old spots are forgotten as others leave, so the map stays small.
      if (this.lastSpot.size > 256)
        for (const [id, s] of this.lastSpot)
          if (now - s.at >= PLAZA_RETURN_MS) this.lastSpot.delete(id);
    }
    // An empty copy stops, paused as it is (no bots or ball running for
    // nobody): someone back within PLAZA_RETURN_MS finds the townsfolk,
    // bots and ball where they were; after that it is dropped.
    const c = v && this.copies.get(v.plaza);
    if (c && !this.population(c.id)) c.emptySince = now;
    return v?.plaza;
  }
  private copy(id: number, now: number) {
    let c = this.copies.get(id);
    if (c) {
      c.emptySince = null;
      return c;
    }
    c = {
      id,
      ball: plazaBallStart(),
      last: {},
      score: [0, 0],
      bots: PITCH_BOTS.map(([name, character], i) => {
        const team = (i < 2 ? 0 : 1) as 0 | 1,
          x = team === 0 ? PLAZA_PITCH.x0 + 150 : PLAZA_PITCH.x1 - 150,
          y = PLAZA_PITCH.y0 + 160 + (i % 2) * 180;
        return {
          key: `bot:${id}:${i}`,
          team,
          body: plazaBody(x, y),
          profile: {
            id: this.nextId++,
            name,
            title: null,
            titleColor: null,
            level: null,
            character,
            skin: null,
            bot: true,
          },
        };
      }),
      folk: [],
      shower: null,
      orbs: new Map(),
      nextOrbAt: now,
      gifts: new Map(),
      emptySince: null,
    };
    this.copies.set(id, c);
    // The first player finds the townsfolk already about their day.
    this.syncFolk(c, 1, true);
    return c;
  }
  /** Keep the right number of townsfolk: newcomers walk in at the gate,
   * and the last to arrive walk out first to make room for players. */
  private syncFolk(c: Copy, players: number, settled = false) {
    const want = townsfolkFor(players),
      staying = c.folk
        .filter((f) => !f.leaving)
        .sort((a, b) => a.index - b.index);
    for (let i = staying.length; i > want; i--) staying[i - 1].leaving = true;
    // Someone on the way out turns back if the room is needed again.
    for (const f of c.folk)
      if (f.leaving && staying.length < want && f.index < want) {
        f.leaving = false;
        f.tx = null;
        staying.push(f);
      }
    const taken = new Set(c.folk.map((f) => f.index));
    for (let index = 0; index < want; index++) {
      if (taken.has(index)) continue;
      const def = TOWNSFOLK[index],
        home = settled ? this.folkHome(def.ai, index) : PLAZA_GATE;
      c.folk.push({
        index,
        ai: def.ai,
        body: plazaBody(home.x, home.y),
        profile: {
          id: this.nextId++,
          name: def.name,
          title: null,
          titleColor: null,
          level: null,
          character: def.character,
          skin: def.skin ? { ...def.skin } : null,
          bot: true,
        },
        tx: null,
        ty: 0,
        wait: this.random() * 2,
        step: 0,
        angle: -Math.PI / 2 - index * 0.9,
        emote: 0,
        emoteUntil: 0,
        leaving: false,
        stuck: 0,
      });
    }
  }
  /** Where a townsperson starts when the Plaza opens. */
  private folkHome(ai: FolkAi, index: number) {
    const a = index * 1.7;
    switch (ai) {
      case "runway":
        return { x: 1350 + (TOWNSFOLK[index].side ?? 1) * 170, y: 685 };
      case "track":
        return trackPoint(-Math.PI / 2 - index * 0.9, TOWNSFOLK[index].lane);
      case "dance":
        return { x: 1480, y: 650 };
      case "cafe":
        return { x: PLAZA_CAFE.x - 70, y: PLAZA_CAFE.y + 70 };
      case "photo":
        return { x: PLAZA_PHOTO.x, y: PLAZA_PHOTO.y + 30 };
      default:
        return plazaCollide({
          x: PLAZA_SQUARE.x + Math.cos(a) * PLAZA_SQUARE.rx * 0.7,
          y: PLAZA_SQUARE.y + Math.sin(a) * PLAZA_SQUARE.ry * 0.7,
        });
    }
  }
  /** The stick: clamped to length 1; non-numbers count as standing still. */
  input(key: string, dx: unknown, dy: unknown, timing?: PlazaTiming) {
    return this.receive(key, { kind: "stick", ...plazaStick(dx, dy) }, timing);
  }
  jump(key: string, timing?: PlazaTiming) {
    return this.receive(key, { kind: "jump", x: 0, y: 0 }, timing);
  }
  /** A dash, the way the browser dashed (`dx`, `dy`; a bad or missing
   * direction falls back to the last stick). */
  dash(key: string, dx?: unknown, dy?: unknown, timing?: PlazaTiming) {
    return this.receive(key, { kind: "dash", ...plazaStick(dx, dy) }, timing);
  }
  /**
   * A stick, jump or dash from the browser. Untimed (no `t`), it applies at
   * once. Timed, it waits for its moment: the browser's time `t` plus the
   * visitor's lead, so the server plays your inputs as far apart as you
   * pressed them however unevenly they arrived — a dash and the stick after
   * it land on the server where they landed on your screen.
   */
  private receive(
    key: string,
    m: Pick<PlazaInput, "kind" | "x" | "y">,
    timing: PlazaTiming = {},
  ) {
    const v = this.visitors.get(key);
    if (!v) return false;
    const seq =
        typeof timing.s === "number" && Number.isSafeInteger(timing.s)
          ? timing.s
          : 0,
      t = timing.t;
    if (typeof t !== "number" || !Number.isFinite(t)) {
      if (seq > v.ack) {
        v.ack = seq;
        v.ackAt = this.movedTo ?? 0;
      }
      return this.apply(v, m);
    }
    // When it reached us, on the step clock.
    const arrived = Math.max(this.realNow(), this.movedTo ?? -Infinity);
    v.seen.push([arrived, arrived - t]);
    v.lead = v.lead === null ? arrived - t : Math.max(v.lead, arrived - t);
    const last = v.queue.at(-1)?.at ?? -Infinity;
    v.queue.push({
      ...m,
      seq,
      // In order, and never held more than PLAZA_INPUT.holdMs.
      at: Math.max(last, Math.min(t + v.lead, arrived + PLAZA_INPUT.holdMs)),
    });
    if (v.queue.length > PLAZA_INPUT.queue) v.queue.shift();
    return true;
  }
  private apply(v: Visitor, m: Pick<PlazaInput, "kind" | "x" | "y">) {
    if (m.kind === "stick") {
      v.dir = { x: m.x, y: m.y };
      return true;
    }
    if (m.kind === "jump") return plazaJump(v.body);
    return plazaDash(v.body, m, PLAZA_DASH_SLACK);
  }
  /** Move a visitor from `from` to `end` (ms), playing their timed inputs on time. */
  private stepVisitor(v: Visitor, from: number, end: number, dt: number) {
    const move = (ms: number) => {
      // plazaStep takes at most 0.1 s at a time.
      for (let left = ms; left > 1e-6; left -= 100)
        plazaStep(v.body, v.dir, Math.min(100, left) / 1000);
    };
    let at = from;
    while (v.queue.length && v.queue[0].at <= end) {
      const m = v.queue.shift()!,
        when = Math.max(at, m.at);
      if (when > at) move(when - at);
      at = when;
      this.apply(v, m);
      if (m.seq > v.ack) {
        v.ack = m.seq;
        v.ackAt = at;
      }
    }
    if (end > at) move(end - at);
    // When the network calms (the late arrival is no longer recent), the
    // lead comes back down, gently: a quick drop would squeeze the next
    // inputs together.
    while (v.seen.length && v.seen[0][0] < end - PLAZA_INPUT.windowMs)
      v.seen.shift();
    if (v.lead !== null && v.seen.length) {
      let recent = -Infinity;
      for (const [, lag] of v.seen) recent = Math.max(recent, lag);
      if (recent < v.lead)
        v.lead -= Math.min(v.lead - recent, dt * PLAZA_INPUT.leadDecay);
    }
  }
  /** At most one emote a second. */
  emote(key: string, kind: unknown, now: number) {
    const v = this.visitors.get(key),
      index = PLAZA_EMOTES.indexOf(kind as PlazaEmote);
    if (!v || index < 0 || now - v.lastEmote < 1000) return false;
    v.lastEmote = now;
    v.emote = index + 1;
    v.pair = false;
    v.emoteUntil = now + PLAZA.emoteSeconds * 1000;
    // Cheering someone on the runway counts for them.
    if (["❤️", "🔥", "👏"].includes(kind as string))
      for (const other of this.visitors.values())
        if (
          other !== v &&
          other.plaza === v.plaza &&
          other.onRunway &&
          Math.hypot(other.body.x - v.body.x, other.body.y - v.body.y) < 750
        ) {
          other.cheers++;
          other.claps++;
        }
    return true;
  }
  /**
   * Ask another player (walker id `to`) for a pair emote (`kind`, a
   * PLAZA_PAIR_EMOTES id). Players only, never yourself, near enough, at
   * most one request every PLAZA_PAIR.askEvery seconds, and one open request
   * per player at a time. `blocked` (account ids) says if either blocked the
   * other: then the request is never delivered, and the asker hears only
   * that they can't be asked.
   */
  pairAsk(
    key: string,
    to: unknown,
    kind: unknown,
    now: number,
    blocked: (a: string, b: string) => boolean = () => false,
  ):
    { ok: true; to: string; ask: PlazaPairAsk } | { ok: false; error: string } {
    const v = this.visitors.get(key);
    if (!v) return { ok: false, error: "Not in the Plaza." };
    const index = PLAZA_PAIR_EMOTES.findIndex((p) => p.id === kind);
    if (index < 0) return { ok: false, error: "Pick a pair emote." };
    if (to === v.profile.id)
      return { ok: false, error: "Ask someone else for that one." };
    const t = [...this.visitors.values()].find(
      (o) => o.plaza === v.plaza && o.profile.id === to,
    );
    if (!t || t === v || blocked(v.accountId, t.accountId))
      return { ok: false, error: "They can't be asked right now." };
    if (now - v.lastAsk < PLAZA_PAIR.askEvery * 1000)
      return { ok: false, error: "Wait a moment before asking again." };
    if (Math.hypot(t.body.x - v.body.x, t.body.y - v.body.y) > PLAZA_PAIR.reach)
      return { ok: false, error: "Walk a little closer first." };
    if (t.invite && t.invite.until > now && t.invite.from !== key)
      return { ok: false, error: "They're answering someone else." };
    v.lastAsk = now;
    t.invite = {
      from: key,
      kind: index,
      until: now + PLAZA_PAIR.askSeconds * 1000,
    };
    return {
      ok: true,
      to: t.key,
      ask: {
        from: v.profile.id,
        name: v.profile.name,
        kind: PLAZA_PAIR_EMOTES[index].id,
        ms: PLAZA_PAIR.askSeconds * 1000,
      },
    };
  }
  /**
   * Answer the request from walker `from`. Yes plays the pair emote for both,
   * facing each other, for PLAZA_PAIR.playSeconds, if the request is still
   * open, the asker still here and near and neither blocked the other.
   */
  pairAnswer(
    key: string,
    from: unknown,
    yes: boolean,
    now: number,
    blocked: (a: string, b: string) => boolean = () => false,
  ):
    | { ok: true; declined: true; asker: string }
    | {
        ok: true;
        declined?: false;
        keys: [string, string];
        start: PlazaPairStart;
      }
    | { ok: false; error: string } {
    const v = this.visitors.get(key);
    if (!v) return { ok: false, error: "Not in the Plaza." };
    const inv = v.invite,
      a = inv && this.visitors.get(inv.from);
    if (!inv || inv.until <= now || !a || a.profile.id !== from) {
      if (inv && inv.until <= now) v.invite = null;
      return { ok: false, error: "That request has ended." };
    }
    v.invite = null;
    if (a.plaza !== v.plaza || blocked(a.accountId, v.accountId))
      return { ok: false, error: "That request has ended." };
    if (!yes) return { ok: true, declined: true, asker: a.key };
    if (
      Math.hypot(a.body.x - v.body.x, a.body.y - v.body.y) >
      PLAZA_PAIR.reach + PLAZA_PAIR.slack
    )
      return { ok: false, error: "You've moved too far apart." };
    const pair = PLAZA_PAIR_EMOTES[inv.kind],
      emote = emoteIndex(pair.emote);
    for (const [p, o] of [
      [a, v],
      [v, a],
    ]) {
      p.emote = emote;
      p.pair = true;
      p.emoteUntil = now + PLAZA_PAIR.playSeconds * 1000;
      p.lastEmote = now;
      p.body.face = o.body.x >= p.body.x ? 1 : -1;
    }
    return {
      ok: true,
      keys: [a.key, v.key],
      start: { kind: pair.id, a: a.profile.id, b: v.profile.id },
    };
  }
  /** At most one gift box every PLAZA_GIFT.throwSeconds; true claims the slot. */
  giftReady(key: string, now: number) {
    const v = this.visitors.get(key);
    if (!v || now - v.lastTreat < PLAZA_GIFT.throwSeconds * 1000) return false;
    v.lastTreat = now;
    return true;
  }
  /** Give the slot back (the database said no). */
  giftRefused(key: string) {
    const v = this.visitors.get(key);
    if (v) v.lastTreat = -Infinity;
  }
  /**
   * A gift box leaves `key`'s hands, tossed PLAZA_GIFT.reach ahead (the way
   * they last walked, else the way they face), onto open ground. Its orbs
   * spill round where it lands. For everyone in that Plaza copy.
   */
  throwGift(
    key: string,
    golden: boolean,
    now = this.clock || Date.now(),
  ): { plaza: number; gift: PlazaGift } | undefined {
    const v = this.visitors.get(key),
      c = v && this.copies.get(v.plaza);
    if (!v || !c) return undefined;
    const b = v.body;
    let dx = b.lastX,
      dy = b.lastY;
    const m = Math.hypot(dx, dy);
    if (m < 0.1) {
      dx = b.face > 0 ? 1 : -1;
      dy = 0;
    } else {
      dx /= m;
      dy /= m;
    }
    const land = plazaCollide({
      x: b.x + dx * PLAZA_GIFT.reach,
      y: b.y + dy * PLAZA_GIFT.reach * 0.75,
    });
    const id = this.nextGift++,
      n = golden ? PLAZA_GIFT.goldenOrbs : PLAZA_GIFT.orbs,
      turn = this.random() * Math.PI * 2,
      orbs = new Map<number, { x: number; y: number }>();
    for (let i = 1; i <= n; i++) {
      const a = turn + ((i - 1) / n) * Math.PI * 2,
        r = PLAZA_GIFT.spill * (0.55 + this.random() * 0.45),
        spot = plazaCollide({
          x: land.x + Math.cos(a) * r,
          y: land.y + Math.sin(a) * r * 0.7,
        });
      orbs.set(i, { x: Math.round(spot.x), y: Math.round(spot.y) });
    }
    const gift = {
      id,
      by: v.profile.id,
      x0: Math.round(b.x),
      y0: Math.round(b.y),
      x: Math.round(land.x),
      y: Math.round(land.y),
      at: now,
      golden,
    };
    c.gifts.set(id, { gift, byKey: key, orbs });
    return { plaza: c.id, gift: this.giftView(c.gifts.get(id)!) };
  }
  private giftView(g: CopyGift): PlazaGift {
    return {
      ...g.gift,
      orbs: [...g.orbs].map(([id, o]) => [id, o.x, o.y]),
    };
  }
  /** The gift boxes in a player's copy right now (sent when they join). */
  giftsFor(key: string): PlazaGift[] {
    const v = this.visitors.get(key),
      c = v && this.copies.get(v.plaza);
    return c ? [...c.gifts.values()].map((g) => this.giftView(g)) : [];
  }
  /** Gift orbs: once out of the box, caught by anyone but the thrower who
   * walks over one; gone when they fade. Each catch counts as an orb
   * (ref "<toss second>-<box id><orb>", under the orb caps). */
  private stepGifts(
    c: Copy,
    players: Visitor[],
    now: number,
    events: PlazaEvent[],
  ) {
    if (!c.gifts.size) return;
    const gone: PlazaGiftGone = [];
    for (const [id, g] of c.gifts) {
      const age = now - g.gift.at;
      if (age > PLAZA_GIFT.lastsMs) {
        for (const orb of g.orbs.keys()) gone.push([id, orb, 0]);
        c.gifts.delete(id);
        continue;
      }
      // Out of the box and landed: the flight, the opening, their hop out.
      if (age < PLAZA_GIFT.flightMs + PLAZA_GIFT.openMs + 350) continue;
      for (const [orb, o] of g.orbs) {
        const v = players.find(
          (p) =>
            p.key !== g.byKey &&
            Math.hypot(p.body.x - o.x, p.body.y - o.y) < ORB_SHOWER.catchRadius,
        );
        if (!v) continue;
        g.orbs.delete(orb);
        gone.push([id, orb, v.profile.id]);
        events.push({
          type: "orb",
          key: v.key,
          ref: `${Math.floor(g.gift.at / 1000)}-${id * 10 + orb}`,
        });
      }
      if (!g.orbs.size) c.gifts.delete(id);
    }
    if (gone.length) events.push({ type: "giftGone", plaza: c.id, gone });
  }
  /** The spot `key` stands at, if it is `spot` (a little slack for lag). */
  at(key: string, spot: PlazaSpotId) {
    const v = this.visitors.get(key);
    return !!v && plazaSpotAt(v.body.x, v.body.y, 40)?.id === spot;
  }
  /**
   * Cast a line at the pond. The server picks the fish now (by rarity, and
   * by the time of day on the player's clock: `tzOffsetMin` is the
   * browser's Date#getTimezoneOffset) and when it bites; the browser hears
   * of the bite from `step` and of the fish only once it is caught.
   */
  cast(key: string, now: number, tzOffsetMin?: unknown) {
    const v = this.visitors.get(key);
    if (!v) return { ok: false as const, error: "Not in the Plaza." };
    if (!this.atPond(v))
      return { ok: false as const, error: "Walk up to the pond first." };
    if (v.line)
      return { ok: false as const, error: "Your line is already out." };
    if (now < v.nextCast) return { ok: false as const, error: "One moment…" };
    const tz = typeof tzOffsetMin === "number" ? tzOffsetMin : 0,
      night = plazaIsNight(plazaTimeOfDay(now, tz)),
      { biteMinMs, biteMaxMs } = PLAZA_FISHING;
    v.line = {
      fish: plazaFishPick(this.random(), night).id,
      biteAt: now + biteMinMs + this.random() * (biteMaxMs - biteMinMs),
      bitAt: null,
      hookedAt: null,
      seed: 0,
    };
    return { ok: true as const };
  }
  /** Tap to reel in: hooked only while the bobber is under (with slack). */
  reel(key: string, now: number): PlazaReel {
    const v = this.visitors.get(key),
      line = v?.line;
    if (!v || !line || line.hookedAt !== null)
      return { ok: false, error: "No line in the water." };
    const lost = (r: PlazaReel) => {
      v.line = null;
      v.nextCast = now + PLAZA_FISHING.castGapMs;
      return r;
    };
    if (line.bitAt === null)
      return lost({
        ok: false,
        error: "Too soon! The fish swam off.",
        why: "early",
      });
    if (now - line.bitAt > PLAZA_FISHING.windowMs + PLAZA_FISHING.slackMs)
      return lost({
        ok: false,
        error: "Too late! The fish got away.",
        why: "late",
      });
    line.hookedAt = now;
    line.seed = Math.floor(this.random() * 2 ** 31);
    return {
      ok: true,
      hooked: true,
      rarity: PLAZA_FISH_BY_ID[line.fish].rarity,
      seed: line.seed,
    };
  }
  /**
   * The fight's end: the browser's presses and let-goes (steps, see
   * plaza-fight.ts). The fight is run again here from the seed; a catch
   * also needs as long to have passed as the fight took (less a little for
   * the network), so a made-up quick win doesn't land anything.
   */
  land(key: string, now: number, moves: unknown): PlazaLand {
    const v = this.visitors.get(key),
      line = v?.line;
    if (!v || !line || line.hookedAt === null)
      return { ok: false, error: "Nothing on the line.", why: "bad" };
    v.line = null;
    v.nextCast = now + PLAZA_FISHING.castGapMs;
    if (!plazaFightMovesOk(moves))
      return { ok: false, error: "The line tangled.", why: "bad" };
    const f = plazaFightReplay(
      line.seed,
      PLAZA_FISH_BY_ID[line.fish].rarity,
      moves,
    );
    if (f.result === "snap")
      return { ok: false, error: "The line snapped!", why: "snap" };
    if (f.result !== "caught")
      return { ok: false, error: "It got away.", why: "escape" };
    if (now - line.hookedAt < f.tick * PLAZA_FIGHT.tickMs - FIGHT_SLACK_MS)
      return { ok: false, error: "The line tangled.", why: "bad" };
    return { ok: true, fish: line.fish };
  }
  /** Leaving fishing mode: the line comes in quietly (no catch, no news). */
  stopFishing(key: string, now: number) {
    const v = this.visitors.get(key);
    if (!v?.line) return false;
    v.line = null;
    v.nextCast = now + PLAZA_FISHING.castGapMs;
    return true;
  }
  /** Fishing state (tests): the line, if any. */
  lineOf(key: string) {
    const line = this.visitors.get(key)?.line;
    return line ? { ...line } : null;
  }
  private atPond(v: Visitor) {
    return (
      plazaSpotAt(v.body.x, v.body.y, PLAZA_FISHING.reachSlack)?.id === "fish"
    );
  }
  /** A line's moment: the bite, a fish that waited too long, or walking off. */
  private stepLine(v: Visitor, now: number, events: PlazaEvent[]) {
    const line = v.line;
    if (!line) return;
    const gone = (why: "late" | "moved") => {
      v.line = null;
      v.nextCast = now + PLAZA_FISHING.castGapMs;
      events.push({ type: "fish", key: v.key, note: { state: "gone", why } });
    };
    if (!this.atPond(v)) return gone("moved");
    if (line.hookedAt !== null) {
      // A fight nobody finished (a closed tab): the fish slips off.
      if (
        now - line.hookedAt >
        PLAZA_FIGHT.maxTicks * PLAZA_FIGHT.tickMs + FIGHT_SLACK_MS * 4
      )
        gone("late");
      return;
    }
    if (line.bitAt === null && now >= line.biteAt) {
      line.bitAt = now;
      events.push({ type: "fish", key: v.key, note: { state: "bite" } });
    } else if (
      line.bitAt !== null &&
      now - line.bitAt > PLAZA_FISHING.windowMs + PLAZA_FISHING.slackMs
    )
      gone("late");
  }
  /** Volt Boba (free): the speed boost. */
  boost(key: string) {
    const v = this.visitors.get(key);
    if (!v) return false;
    v.body.boost = PLAZA.boba.seconds;
    return true;
  }
  boosted(key: string) {
    return (this.visitors.get(key)?.body.boost ?? 0) > 0;
  }
  /** Level and skin arrive after joining (they need account lookups). */
  updateProfile(key: string, patch: Partial<Omit<PlazaProfile, "id" | "bot">>) {
    const v = this.visitors.get(key);
    if (!v) return;
    v.profile = { ...v.profile, ...patch };
    v.version++;
  }

  step(dt: number, now: number): PlazaEvent[] {
    this.clock = now;
    // Players move through the time since the last step: usually `dt`, more
    // when a tick ran late (a busy server), at most a second.
    const last = this.movedTo,
      from =
        last !== null && now > last && now - last <= 1000
          ? last
          : now - dt * 1000;
    this.movedTo = now;
    const events: PlazaEvent[] = [];
    for (const v of this.visitors.values()) {
      this.stepVisitor(v, from, now, dt);
      if (v.emote && now >= v.emoteUntil) {
        v.emote = 0;
        v.pair = false;
      }
      this.stepLine(v, now, events);
      const lap = v.lap.update(v.body.x, v.body.y, now);
      if (lap.lapMs !== undefined && lap.lapMs >= 1000) {
        events.push({ type: "lap", key: v.key, ms: lap.lapMs });
        events.push({
          type: "news",
          plaza: v.plaza,
          news: {
            kind: "lap",
            id: v.profile.id,
            name: v.profile.name,
            ms: lap.lapMs,
          },
        });
      }
      const runway = onRunway(v.body.x, v.body.y);
      if (runway && !v.onRunway && now - v.runwayNewsAt > 20_000) {
        v.runwayNewsAt = now;
        events.push({
          type: "news",
          plaza: v.plaza,
          news: { kind: "runway", id: v.profile.id, name: v.profile.name },
        });
      }
      v.onRunway = runway;
      if (runway) {
        v.cheerIn -= dt;
        if (v.cheerIn <= 0) {
          v.cheerIn += PLAZA_CHEER_SECONDS;
          v.cheers++;
          v.claps++;
        }
      }
      // Tell the database each time the cheers reach the quest, not every
      // cheer (it keeps the day's best, so a repeat changes nothing).
      if (v.cheers >= 15) {
        events.push({ type: "cheers", key: v.key, n: 15 });
        v.cheers = 0;
      }
    }
    for (const c of this.copies.values()) {
      if (c.emptySince !== null) {
        if (now - c.emptySince >= PLAZA_RETURN_MS) this.copies.delete(c.id);
        continue;
      }
      this.stepCopy(c, dt, now, events);
    }
    return events;
  }
  private stepCopy(c: Copy, dt: number, now: number, events: PlazaEvent[]) {
    const players = [...this.visitors.values()].filter((v) => v.plaza === c.id);
    for (const bot of c.bots) plazaStep(bot.body, this.botStick(c, bot), dt);
    // Bots never stand inside one another (players still pass through
    // each other, the Plaza being a place to meet).
    separateBodies(c.bots.map((b) => b.body));
    this.syncFolk(c, players.length);
    for (const f of c.folk) {
      if (f.emote && now >= f.emoteUntil) f.emote = 0;
      const stick = this.folkStick(f, dt, now);
      plazaStep(f.body, stick, dt);
      // Walking into a wall, a house or the fountain: try somewhere else.
      if (
        Math.hypot(stick.x, stick.y) > 0.5 &&
        f.body.speed < 40 &&
        !f.body.stun
      )
        f.stuck += dt;
      else f.stuck = 0;
      if (f.stuck > 2.5 && !f.leaving) {
        f.stuck = 0;
        f.tx = null;
        f.step++;
      }
    }
    // Gone through the gate (or slipped away where the way out was blocked).
    c.folk = c.folk.filter(
      (f) =>
        !f.leaving ||
        (f.stuck <= 2.5 &&
          Math.hypot(f.body.x - PLAZA_GATE.x, f.body.y - PLAZA_GATE.y) > 30),
    );
    const touch = [
      ...players.map((v) => ({ key: v.key, body: v.body })),
      ...c.bots.map((b) => ({ key: b.key, body: b.body })),
    ];
    const kick = plazaBallStep(c.ball, touch, dt, c.last);
    if (kick.goal !== undefined) {
      c.score[kick.goal]++;
      const scorer =
        players.find((v) => v.key === kick.scorer) ??
        c.bots.find((b) => b.key === kick.scorer);
      if (scorer && "accountId" in scorer)
        events.push({ type: "goal", key: scorer.key });
      if (scorer)
        events.push({
          type: "news",
          plaza: c.id,
          news: {
            kind: "goal",
            id: scorer.profile.id,
            name: scorer.profile.name,
            side: kick.goal,
          },
        });
    }
    this.stepOrbs(c, players, now, events);
    this.stepGifts(c, players, now, events);
  }
  /** A townsperson's emote, seen by everyone in the copy. */
  private folkEmote(f: Folk, e: (typeof PLAZA_EMOTES)[number], now: number) {
    f.emote = emoteIndex(e);
    f.emoteUntil = now + PLAZA.emoteSeconds * 1000;
  }
  /** Townsfolk brains, after the prototype's (no orb chasing: they can't
   * catch orbs, and no news: they never post as players do). */
  private folkStick(f: Folk, dt: number, now: number) {
    const b = f.body,
      toward = (x: number, y: number) => {
        const dx = x - b.x,
          dy = y - b.y,
          d = Math.hypot(dx, dy);
        return d < 8 ? { x: 0, y: 0, d } : { x: dx / d, y: dy / d, d };
      };
    if (f.leaving) return toward(PLAZA_GATE.x, PLAZA_GATE.y);
    if (f.wait > 0) {
      f.wait -= dt;
      return { x: 0, y: 0 };
    }
    switch (f.ai) {
      case "wander": {
        if (f.tx === null) {
          const a = this.random() * Math.PI * 2,
            r = 0.45 + this.random() * 0.5,
            p = plazaCollide({
              x: PLAZA_SQUARE.x + Math.cos(a) * PLAZA_SQUARE.rx * r,
              y: PLAZA_SQUARE.y + Math.sin(a) * PLAZA_SQUARE.ry * r,
            });
          f.tx = p.x;
          f.ty = p.y;
        }
        const d = toward(f.tx, f.ty);
        if (d.d < 10) {
          f.tx = null;
          f.wait = 1 + this.random() * 3;
          if (this.random() < 0.35)
            this.folkEmote(
              f,
              (["👋", "😂", "GG", "🔥", "❤️", "😎"] as const)[
                Math.floor(this.random() * 6)
              ],
              now,
            );
          if (this.random() < 0.2) plazaJump(b);
        }
        return d;
      }
      case "runway": {
        const steps = RUNWAY_STEPS(TOWNSFOLK[f.index].side ?? 1),
          at = f.step % steps.length,
          [x, y] = steps[at],
          d = toward(x, y);
        if (d.d < 10) {
          if (at === 4) {
            f.wait = 3.2;
            this.folkEmote(f, this.random() < 0.5 ? "😎" : "💃", now);
          } else if (at === 6) f.wait = 6 + this.random() * 6;
          f.step++;
        }
        return d;
      }
      case "track": {
        const def = TOWNSFOLK[f.index];
        f.angle += dt * (def.pace ?? 0.55);
        const p = trackPoint(f.angle, def.lane),
          q = trackPolar(b.x, b.y);
        // Jump the hurdle ahead so the top of the jump is over it: half a
        // jump's time before they get there at their pace round the track.
        const lead = ((def.pace ?? 0.55) * PLAZA.jump.seconds) / 2;
        if (
          onTrack(b.x, b.y) &&
          PLAZA_HURDLES.some((h) => {
            const ahead = ((h - q.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            return ahead > 0 && ahead < lead;
          })
        )
          plazaJump(b);
        return toward(p.x, p.y);
      }
      case "dance": {
        const d = toward(1480, 650);
        if (d.d < 12) {
          if (!f.emote && this.random() < 0.02) this.folkEmote(f, "💃", now);
          return { x: 0, y: 0 };
        }
        return d;
      }
      case "cafe": {
        const d = toward(PLAZA_CAFE.x - 70, PLAZA_CAFE.y + 70);
        if (d.d < 10) {
          if (!f.emote && this.random() < 0.004) this.folkEmote(f, "😎", now);
          return { x: 0, y: 0 };
        }
        return d;
      }
      case "photo": {
        if (f.tx === null) {
          f.tx = PLAZA_PHOTO.x + (this.random() - 0.5) * 60;
          f.ty = PLAZA_PHOTO.y + 30 + (this.random() - 0.5) * 30;
        }
        const d = toward(f.tx, f.ty);
        if (d.d < 10) {
          f.wait = 4;
          this.folkEmote(f, "👏", now);
          // Now and then a stroll to the square and back.
          if (this.random() < 0.5) f.tx = null;
          else {
            f.tx = PLAZA_SQUARE.x - 120;
            f.ty = PLAZA_SQUARE.y - 60;
          }
        }
        return d;
      }
    }
  }
  /** The teammate nearer the ball chases it (a near tie goes to the first,
   * so they don't swap every step). */
  private chasesBall(c: Copy, bot: Bot) {
    const mate = c.bots.find((t) => t.team === bot.team && t !== bot);
    if (!mate) return true;
    const d = (b: PlazaBody) => Math.hypot(b.x - c.ball.x, b.y - c.ball.y);
    const mine = d(bot.body),
      theirs = d(mate.body);
    if (Math.abs(mine - theirs) < BOT_SUPPORT.tie)
      return c.bots.indexOf(bot) < c.bots.indexOf(mate);
    return mine < theirs;
  }
  /** Pitch bots: get behind the ball and push it at the other goal (the prototype's brain). */
  private botStick(c: Copy, bot: Bot) {
    const b = bot.body,
      ball = c.ball,
      toward = (x: number, y: number) => {
        const dx = x - b.x,
          dy = y - b.y,
          d = Math.hypot(dx, dy);
        return d < 8 ? { x: 0, y: 0, d } : { x: dx / d, y: dy / d, d };
      };
    if (ball.lock > 0 || !inPitch(ball.x, ball.y, 40)) {
      const home = toward(
        bot.team === 0 ? PLAZA_PITCH.x0 + 150 : PLAZA_PITCH.x1 - 150,
        (PLAZA_PITCH.y0 + PLAZA_PITCH.y1) / 2,
      );
      return { x: home.x * 0.6, y: home.y * 0.6 };
    }
    const goalX = bot.team === 0 ? PLAZA_PITCH.x1 + 30 : PLAZA_PITCH.x0 - 30,
      goalY = (PLAZA_PITCH.gy0 + PLAZA_PITCH.gy1) / 2,
      gx = goalX - ball.x,
      gy = goalY - ball.y,
      gd = Math.hypot(gx, gy) || 1;
    // One teammate goes for the ball; the other backs them up behind and
    // to the side, so two bots never chase the same spot.
    if (!this.chasesBall(c, bot)) {
      const mate = c.bots.find((t) => t.team === bot.team && t !== bot)!;
      const side = mate.body.y > ball.y ? -1 : 1;
      const spot = toward(
        clampTo(
          ball.x - (gx / gd) * BOT_SUPPORT.back,
          PLAZA_PITCH.x0 + 40,
          PLAZA_PITCH.x1 - 40,
        ),
        clampTo(
          ball.y + side * BOT_SUPPORT.wide,
          PLAZA_PITCH.y0 + 40,
          PLAZA_PITCH.y1 - 40,
        ),
      );
      return spot.d < 20
        ? { x: 0, y: 0 }
        : { x: spot.x * 0.7, y: spot.y * 0.7 };
    }
    const behind = toward(ball.x - (gx / gd) * 44, ball.y - (gy / gd) * 44);
    if (behind.d > 28) return { x: behind.x * 0.82, y: behind.y * 0.82 };
    if (this.random() < 0.036) plazaDash(b);
    const at = toward(ball.x, ball.y);
    return { x: at.x, y: at.y };
  }
  private stepOrbs(
    c: Copy,
    players: Visitor[],
    now: number,
    events: PlazaEvent[],
  ) {
    const s = orbShower(now);
    if (!s.on) {
      if (c.shower) {
        const gone = [...c.orbs.keys()].map(
          (id) => [id, 0] as [number, number],
        );
        c.orbs.clear();
        events.push({
          type: "orbs",
          plaza: c.id,
          orbs: { shower: c.shower, add: [], gone },
        });
        c.shower = null;
      }
      return;
    }
    if (c.shower !== s.key) {
      c.shower = s.key;
      c.orbs.clear();
      c.nextOrbAt = now;
      events.push({
        type: "orbs",
        plaza: c.id,
        orbs: { shower: s.key, add: [], gone: [], reset: true },
      });
    }
    const add: PlazaOrb[] = [],
      gone: [number, number][] = [];
    while (
      now >= c.nextOrbAt &&
      now < s.endsAt - ORB_SHOWER.stopBeforeEndMs &&
      c.orbs.size < ORB_SHOWER.maxOrbs
    ) {
      const a = this.random() * Math.PI * 2,
        r = 0.3 + this.random() * 0.75,
        orb = {
          id: this.nextOrb++,
          x: Math.round(
            PLAZA_SQUARE.x + Math.cos(a) * PLAZA_SQUARE.rx * r * 1.1,
          ),
          y: Math.round(
            PLAZA_SQUARE.y + Math.sin(a) * PLAZA_SQUARE.ry * r * 1.1,
          ),
          at: now,
        };
      const spot = plazaCollide({ x: orb.x, y: orb.y });
      orb.x = Math.round(spot.x);
      orb.y = Math.round(spot.y);
      c.orbs.set(orb.id, orb);
      add.push([orb.id, orb.x, orb.y, orb.at]);
      c.nextOrbAt = Math.max(
        c.nextOrbAt + ORB_SHOWER.spawnMs,
        now - ORB_SHOWER.spawnMs,
      );
    }
    for (const orb of c.orbs.values()) {
      if (orbHeight(now - orb.at) > ORB_SHOWER.catchHeight) continue;
      const v = players.find(
        (p) =>
          Math.hypot(p.body.x - orb.x, p.body.y - orb.y) <
          ORB_SHOWER.catchRadius,
      );
      if (!v) continue;
      c.orbs.delete(orb.id);
      gone.push([orb.id, v.profile.id]);
      const caught = (v.orbs.get(s.key) ?? 0) + 1;
      v.orbs.set(s.key, caught);
      if (v.orbs.size > 4) v.orbs.delete(v.orbs.keys().next().value!);
      if (caught <= ORB_SHOWER.perShower)
        events.push({ type: "orb", key: v.key, ref: `${s.key}-${orb.id}` });
    }
    if (add.length || gone.length)
      events.push({
        type: "orbs",
        plaza: c.id,
        orbs: { shower: s.key, add, gone },
      });
  }
  /** The orbs in a player's copy right now (sent when they join). */
  orbsFor(key: string): PlazaOrbs | undefined {
    const v = this.visitors.get(key),
      c = v && this.copies.get(v.plaza);
    if (!c?.shower) return undefined;
    return {
      shower: c.shower,
      add: [...c.orbs.values()].map((o) => [o.id, o.x, o.y, o.at]),
      gone: [],
      reset: true,
    };
  }
  /** What one player sees: nearby bodies in their copy, the ball, new profiles. */
  view(
    key: string,
  ): { state: PlazaState; profiles: PlazaProfile[] } | undefined {
    const me = this.visitors.get(key),
      c = me && this.copies.get(me.plaza);
    if (!me || !c) return undefined;
    const told = this.told.get(key)!,
      walkers: PlazaWalker[] = [],
      profiles: PlazaProfile[] = [];
    const see = (b: PlazaBody) =>
      Math.abs(b.x - me.body.x) < PLAZA.view.w / 2 + 80 &&
      Math.abs(b.y - me.body.y) < PLAZA.view.h / 2 + 80;
    const add = (
      body: PlazaBody,
      profile: PlazaProfile,
      version: number,
      emote: number,
      bot: boolean,
      extra = 0,
    ) => {
      const flags =
        (body.dash > 0 ? PLAZA_FLAG.dash : 0) |
        (body.stun > 0 ? PLAZA_FLAG.stun : 0) |
        (body.boost > 0 ? PLAZA_FLAG.boost : 0) |
        (bot ? PLAZA_FLAG.bot : 0) |
        extra;
      walkers.push([
        profile.id,
        Math.round(body.x),
        Math.round(body.y),
        Math.round(body.z),
        body.face,
        flags,
        emote,
        Math.round(body.speed),
      ]);
      if (told.get(profile.id) !== version) {
        told.set(profile.id, version);
        profiles.push(profile);
      }
    };
    for (const v of this.visitors.values())
      if (v.plaza === me.plaza && (v === me || see(v.body)))
        add(
          v.body,
          v.profile,
          v.version,
          v.emote,
          false,
          v.pair && v.emote ? PLAZA_FLAG.pair : 0,
        );
    for (const b of c.bots) if (see(b.body)) add(b.body, b.profile, 1, 0, true);
    for (const f of c.folk)
      if (see(f.body)) add(f.body, f.profile, 1, f.emote, true);
    const pitchInView =
      Math.abs((PLAZA_PITCH.x0 + PLAZA_PITCH.x1) / 2 - me.body.x) <
        PLAZA.view.w / 2 + 400 &&
      Math.abs((PLAZA_PITCH.y0 + PLAZA_PITCH.y1) / 2 - me.body.y) <
        PLAZA.view.h / 2 + 300;
    return {
      state: {
        plaza: me.plaza,
        population: this.population(me.plaza),
        me: me.profile.id,
        now: this.clock,
        walkers,
        ...(pitchInView
          ? {
              ball: [
                Math.round(c.ball.x),
                Math.round(c.ball.y),
                Math.round(c.ball.z),
                Math.round(c.ball.vx),
                Math.round(c.ball.vy),
                Math.round(c.ball.vz),
                Math.round(c.ball.lock * 100) / 100,
              ] as [number, number, number, number, number, number, number],
            }
          : {}),
        score: [...c.score] as [number, number],
        claps: me.claps,
        ...(me.ack
          ? {
              ack: [me.ack, Math.round((this.movedTo ?? 0) - me.ackAt)] as [
                number,
                number,
              ],
            }
          : {}),
        ...(me.lap.running
          ? {
              lap: [
                me.lap.startTime,
                Math.round(me.lap.progress * 100) / 100,
              ] as [number, number],
            }
          : {}),
      },
      profiles,
    };
  }
}
