import {
  LapTimer,
  ORB_SHOWER,
  PLAZA,
  PLAZA_CAFE,
  PLAZA_CHEER_SECONDS,
  PLAZA_EMOTES,
  PLAZA_FLAG,
  PLAZA_GATE,
  PLAZA_HURDLES,
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
  plazaJump,
  plazaSpotAt,
  plazaStep,
  plazaStick,
  onTrack,
  trackPoint,
  trackPolar,
  type PlazaBall,
  type PlazaBody,
  type PlazaEmote,
  type PlazaNews,
  type PlazaTreat,
  type PlazaOrb,
  type PlazaOrbs,
  type PlazaProfile,
  type PlazaSpotId,
  type PlazaState,
  type PlazaWalker,
} from "../../../packages/shared/src/plaza.js";

/**
 * The new Plaza (hub redesign phase 3): who is where, the pitch bots, the
 * ball, the Orb Shower, lap times and runway cheers. Pure state (no sockets),
 * so it can be tested directly; server.ts wires it to connections and pays
 * Gold Leaves for what `step` reports.
 */
interface Visitor {
  key: string;
  accountId: string;
  plaza: number;
  body: PlazaBody;
  dir: { x: number; y: number };
  emote: number;
  emoteUntil: number;
  lastEmote: number;
  /** When this visitor last threw a treat (ms). */
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
  profile: PlazaProfile;
  version: number;
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
}
/** What happened this step, for server.ts to pay and announce. */
export type PlazaEvent =
  | { type: "orb"; key: string; ref: string }
  | { type: "goal"; key: string }
  | { type: "lap"; key: string; ms: number }
  | { type: "cheers"; key: string; n: number }
  | { type: "news"; plaza: number; news: PlazaNews }
  | { type: "orbs"; plaza: number; orbs: PlazaOrbs };

const BOT_LOOKS = [
  ["Blue Bot", "voltkit"],
  ["Blue Bot", "tidefin"],
  ["Red Bot", "cindrake"],
  ["Red Bot", "duskveil"],
] as const;

/**
 * Townsfolk: NPCs who keep a quiet Plaza lively, as in the approved
 * prototype (docs/hub-redesign/prototype/app/plaza.js). They are marked as
 * bots (role names, not player names; no card, no Add friend), wear Shop
 * skins, and step aside as players arrive. They never count for anything:
 * no population, laps, cheers, orbs, goals, treats or news.
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
    skin: { skin: "mystowl-oracle", stage: 2 },
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
    skin: { skin: "terradon-world-shell", stage: 1 },
    ai: "track",
    lane: 0.3,
    pace: 0.62,
  },
  {
    name: "Dancer",
    character: "voltkit",
    skin: { skin: "voltkit-stormcrown", stage: 2 },
    ai: "dance",
  },
  {
    name: "Café Regular",
    character: "lumoth",
    skin: { skin: "lumoth-starweaver", stage: 1 },
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
    skin: { skin: "pyranda-harvest-moon", stage: 1 },
    ai: "wander",
  },
  {
    name: "Runway Model",
    character: "tidefin",
    skin: { skin: "tidefin-moontide", stage: 2 },
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

export class PlazaWorld {
  private visitors = new Map<string, Visitor>();
  private copies = new Map<number, Copy>();
  private nextId = 1;
  private nextOrb = 1;
  private told = new Map<string, Map<number, number>>();
  private clock = 0;
  constructor(private random: () => number = Math.random) {}

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
  keys() {
    return [...this.visitors.keys()];
  }
  /** Where someone is (tests and the photo). */
  bodyOf(key: string) {
    return this.visitors.get(key)?.body;
  }

  join(
    key: string,
    accountId: string,
    profile: Omit<PlazaProfile, "id" | "bot">,
    now = Date.now(),
  ) {
    const existing = this.visitors.get(key);
    if (existing) return existing;
    for (const [k, v] of this.visitors)
      if (v.accountId === accountId) this.leave(k);
    let plaza = 1;
    while (this.population(plaza) >= PLAZA.capacity) plaza++;
    const a = this.random() * Math.PI * 2,
      spot = plazaCollide({
        x: PLAZA_SPAWN.x + Math.cos(a) * 70 * this.random(),
        y: PLAZA_SPAWN.y + Math.sin(a) * 30 * this.random(),
      });
    const visitor: Visitor = {
      key,
      accountId,
      plaza,
      body: plazaBody(spot.x, spot.y),
      dir: { x: 0, y: 0 },
      emote: 0,
      emoteUntil: 0,
      lastEmote: -Infinity,
      lastTreat: -Infinity,
      lap: new LapTimer(),
      cheerIn: PLAZA_CHEER_SECONDS,
      cheers: 0,
      claps: 0,
      onRunway: false,
      runwayNewsAt: -Infinity,
      orbs: new Map(),
      profile: { ...profile, accountId, id: this.nextId++ },
      version: 1,
    };
    this.visitors.set(key, visitor);
    this.told.set(key, new Map());
    this.copy(plaza, now);
    return visitor;
  }
  leave(key: string) {
    const v = this.visitors.get(key);
    this.visitors.delete(key);
    this.told.delete(key);
    // An empty copy stops: no bots or ball running for nobody.
    if (v && !this.population(v.plaza)) this.copies.delete(v.plaza);
    return v?.plaza;
  }
  private copy(id: number, now: number) {
    let c = this.copies.get(id);
    if (c) return c;
    c = {
      id,
      ball: plazaBallStart(),
      last: {},
      score: [0, 0],
      bots: BOT_LOOKS.map(([name, character], i) => {
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
  input(key: string, dx: unknown, dy: unknown) {
    const v = this.visitors.get(key);
    if (!v) return false;
    v.dir = plazaStick(dx, dy);
    return true;
  }
  jump(key: string) {
    const v = this.visitors.get(key);
    return !!v && plazaJump(v.body);
  }
  dash(key: string) {
    const v = this.visitors.get(key);
    return !!v && plazaDash(v.body);
  }
  /** At most one emote a second. */
  emote(key: string, kind: unknown, now: number) {
    const v = this.visitors.get(key),
      index = PLAZA_EMOTES.indexOf(kind as PlazaEmote);
    if (!v || index < 0 || now - v.lastEmote < 1000) return false;
    v.lastEmote = now;
    v.emote = index + 1;
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
  /** At most one treat every PLAZA.treatSeconds; true claims the slot. */
  treatReady(key: string, now: number) {
    const v = this.visitors.get(key);
    if (!v || now - v.lastTreat < PLAZA.treatSeconds * 1000) return false;
    v.lastTreat = now;
    return true;
  }
  /** A treat leaves `key`'s hands: where, for everyone in that Plaza copy. */
  treat(key: string, crop: string): PlazaTreat | undefined {
    const v = this.visitors.get(key);
    if (!v) return undefined;
    return {
      id: v.profile.id,
      crop,
      x: Math.round(v.body.x),
      y: Math.round(v.body.y),
    };
  }
  /** The spot `key` stands at, if it is `spot` (a little slack for lag). */
  at(key: string, spot: PlazaSpotId) {
    const v = this.visitors.get(key);
    return !!v && plazaSpotAt(v.body.x, v.body.y, 40)?.id === spot;
  }
  /** Volt Boba, after the leaves were paid. */
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
    const events: PlazaEvent[] = [];
    for (const v of this.visitors.values()) {
      plazaStep(v.body, v.dir, dt);
      if (v.emote && now >= v.emoteUntil) v.emote = 0;
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
    for (const c of this.copies.values()) this.stepCopy(c, dt, now, events);
    return events;
  }
  private stepCopy(c: Copy, dt: number, now: number, events: PlazaEvent[]) {
    const players = [...this.visitors.values()].filter((v) => v.plaza === c.id);
    for (const bot of c.bots) plazaStep(bot.body, this.botStick(c, bot), dt);
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
        // Jump the hurdle just ahead.
        if (
          onTrack(b.x, b.y) &&
          PLAZA_HURDLES.some((h) => {
            const ahead = ((h - q.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            return ahead > 0 && ahead < 0.17;
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
      gd = Math.hypot(gx, gy) || 1,
      behind = toward(ball.x - (gx / gd) * 44, ball.y - (gy / gd) * 44);
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
    ) => {
      const flags =
        (body.dash > 0 ? PLAZA_FLAG.dash : 0) |
        (body.stun > 0 ? PLAZA_FLAG.stun : 0) |
        (body.boost > 0 ? PLAZA_FLAG.boost : 0) |
        (bot ? PLAZA_FLAG.bot : 0);
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
        add(v.body, v.profile, v.version, v.emote, false);
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
              ] as [number, number, number],
            }
          : {}),
        score: [...c.score] as [number, number],
        claps: me.claps,
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
