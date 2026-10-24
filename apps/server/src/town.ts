import {
  TOWN,
  TOWN_EMOTES,
  townCanSee,
  townCollide,
  townStep,
  type TownEmote,
  type TownProfile,
  type TownState,
  type TownWalker,
} from "../../../packages/shared/src/town.js";

/**
 * The shared town: who is walking where. Pure state (no sockets), so it can
 * be tested directly; server.ts wires it to connections.
 */
interface Walker {
  key: string;
  accountId: string;
  town: number;
  x: number;
  y: number;
  angle: number;
  dx: number;
  dy: number;
  moving: boolean;
  emote: number;
  emoteUntil: number;
  lastEmote: number;
  jumpUntil: number;
  lastJump: number;
  profile: TownProfile;
  /** Bumped whenever the profile changes, so viewers re-fetch it. */
  version: number;
}
export class TownWorld {
  private walkers = new Map<string, Walker>();
  private nextId = 1;
  /** What each viewer has been told about each walker: id → profile version. */
  private told = new Map<string, Map<number, number>>();

  get size() {
    return this.walkers.size;
  }
  population(town: number) {
    let n = 0;
    for (const w of this.walkers.values()) if (w.town === town) n++;
    return n;
  }
  townOf(key: string) {
    return this.walkers.get(key)?.town;
  }
  profileOf(key: string) {
    return this.walkers.get(key)?.profile;
  }
  keys() {
    return [...this.walkers.keys()];
  }

  join(key: string, accountId: string, profile: Omit<TownProfile, "id">, random = Math.random) {
    const existing = this.walkers.get(key);
    if (existing) return existing;
    // One body per account: a second tab replaces the first.
    for (const [k, w] of this.walkers) if (w.accountId === accountId) this.leave(k);
    let town = 1;
    while (this.population(town) >= TOWN.capacity) town++;
    const angle = random() * Math.PI * 2,
      spot = townCollide(TOWN.spawn.x + Math.cos(angle) * 60 * random(), TOWN.spawn.y + Math.sin(angle) * 30 * random());
    const walker: Walker = {
      key,
      accountId,
      town,
      ...spot,
      angle: -Math.PI / 2,
      dx: 0,
      dy: 0,
      moving: false,
      emote: 0,
      emoteUntil: 0,
      lastEmote: 0,
      jumpUntil: 0,
      lastJump: -Infinity,
      profile: { ...profile, id: this.nextId++ },
      version: 1,
    };
    this.walkers.set(key, walker);
    this.told.set(key, new Map());
    return walker;
  }
  leave(key: string) {
    const w = this.walkers.get(key);
    this.walkers.delete(key);
    this.told.delete(key);
    return w?.town;
  }
  /** The stick: any length is clamped; non-numbers count as standing still. */
  input(key: string, dx: unknown, dy: unknown) {
    const w = this.walkers.get(key);
    if (!w) return false;
    const x = typeof dx === "number" && Number.isFinite(dx) ? Math.max(-1, Math.min(1, dx)) : 0,
      y = typeof dy === "number" && Number.isFinite(dy) ? Math.max(-1, Math.min(1, dy)) : 0;
    w.dx = x;
    w.dy = y;
    return true;
  }
  /** At most one emote a second. */
  emote(key: string, kind: unknown, now: number) {
    const w = this.walkers.get(key);
    const index = TOWN_EMOTES.indexOf(kind as TownEmote);
    if (!w || index < 0 || now - w.lastEmote < 1000) return false;
    w.lastEmote = now;
    w.emote = index + 1;
    w.emoteUntil = now + TOWN.emoteMs;
    return true;
  }
  /** A hop (purely for show; it doesn't change where you can walk). */
  jump(key: string, now: number) {
    const w = this.walkers.get(key);
    if (!w || now - w.lastJump < TOWN.jumpEveryMs) return false;
    w.lastJump = now;
    w.jumpUntil = now + TOWN.jumpMs;
    return true;
  }
  /** Level and skin arrive after joining (they need account lookups). */
  updateProfile(key: string, patch: Partial<Omit<TownProfile, "id">>) {
    const w = this.walkers.get(key);
    if (!w) return;
    w.profile = { ...w.profile, ...patch };
    w.version++;
  }
  private clock = 0;
  step(dt: number, now: number) {
    this.clock = now;
    for (const w of this.walkers.values()) {
      const next = townStep(w, w.dx, w.dy, dt);
      w.x = next.x;
      w.y = next.y;
      w.moving = next.moving;
      if (w.moving) w.angle = Math.atan2(w.dy, w.dx);
      if (w.emote && now >= w.emoteUntil) w.emote = 0;
    }
  }
  /** What one player sees: nearby walkers in their town, and new profiles. */
  view(key: string): { state: TownState; profiles: TownProfile[] } | undefined {
    const me = this.walkers.get(key);
    if (!me) return undefined;
    const told = this.told.get(key)!;
    const walkers: TownWalker[] = [],
      profiles: TownProfile[] = [];
    for (const w of this.walkers.values()) {
      if (w.town !== me.town || (w !== me && !townCanSee(me, w))) continue;
      walkers.push([w.profile.id, Math.round(w.x), Math.round(w.y), Math.round(w.angle * 100) / 100, w.moving ? 1 : 0, w.emote, w.jumpUntil > this.clock ? 1 : 0]);
      if (told.get(w.profile.id) !== w.version) {
        told.set(w.profile.id, w.version);
        profiles.push(w.profile);
      }
    }
    return {
      state: { town: me.town, population: this.population(me.town), me: me.profile.id, walkers },
      profiles,
    };
  }
}
