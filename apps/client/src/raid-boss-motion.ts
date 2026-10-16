import type { Snapshot } from "@arena/shared";

export type RaidBossCue =
  | "roar"
  | "step"
  | "slam"
  | "crash"
  | "awaken"
  | "fall"
  | "charge"
  | "debris"
  | "debris-hit"
  | "core"
  | "chip";
export interface BossFragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  glow: boolean;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export class RaidBossMotion {
  private previous?: {
    time: number;
    x: number;
    y: number;
    hp: number;
    phase: number;
    stage: Snapshot["phase"];
    seed: number;
    result: unknown;
  };
  private clock?: number;
  private hurtAge = 10;
  private phaseAge = 10;
  private deathAge = 0;
  private slamAge = 10;
  private crashAge = 10;
  private strideAge = 0;
  private speed = 0;
  private seenWarnings = new Set<number>();
  private broken = new Set<number>();
  private pendingSlams = new Map<number, number>();
  private pendingDebris = new Map<
    number,
    { at: number; x: number; y: number }
  >();
  private serial = 0;
  private chipAt = -10;
  time = 0;
  fragments: BossFragment[] = [];

  sample(state: Snapshot, clock: number, reduced = false) {
    const r = state.raid,
      b = state.players.find((p) => p.raidBoss);
    if (!r || !b) return null;
    const p = this.previous;
    const reset =
      !p ||
      p.seed !== r.seed ||
      state.time < p.time ||
      (!!p.result && !r.result);
    if (reset) {
      this.clock = clock;
      this.time = 0;
      this.hurtAge = this.phaseAge = this.slamAge = this.crashAge = 10;
      this.deathAge = 0;
      this.chipAt = -10;
      this.speed = 0;
      this.strideAge = 0;
      this.seenWarnings.clear();
      this.pendingSlams.clear();
      this.pendingDebris.clear();
      this.fragments = [];
      this.broken = new Set(r.pillars.flatMap((v, i) => (v.broken ? [i] : [])));
    }
    const dt =
      state.phase === "paused"
        ? 0
        : Math.max(0, Math.min(0.1, clock - (this.clock ?? clock)));
    this.clock = clock;
    this.time += dt;
    this.hurtAge += dt;
    this.phaseAge += dt;
    this.slamAge += dt;
    this.crashAge += dt;
    const cues: RaidBossCue[] = [];
    const burst = (x: number, y: number, count: number, glow = false) => {
      if (reduced) return;
      for (let i = 0; i < count; i++) {
        const a = ++this.serial * 2.39996,
          speed = 40 + (this.serial % 7) * 16;
        this.fragments.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: -60 - Math.abs(Math.sin(a)) * 130,
          age: 0,
          life: 0.65 + (this.serial % 5) * 0.12,
          size: 3 + (this.serial % 6),
          glow,
        });
      }
      this.fragments = this.fragments.slice(-64);
    };
    const live = state.phase === "playing";
    if (p && !reset) {
      const serverDt = state.time - p.time;
      if (serverDt > 0)
        this.speed = live ? Math.hypot(b.x - p.x, b.y - p.y) / serverDt : 0;
      if (b.hp < p.hp && b.hp > 0) {
        if (this.time - this.chipAt >= 0.1) {
          burst(
            b.x,
            b.y - 10,
            5,
            r.phase === 3 ||
              r.exposedUntil > state.time ||
              r.staggerUntil > state.time,
          );
          this.chipAt = this.time;
          cues.push(
            r.phase === 3 ||
              r.exposedUntil > state.time ||
              r.staggerUntil > state.time
              ? "core"
              : "chip",
          );
        }
        this.hurtAge = 0;
      }
      if (
        r.phase > 1 &&
        live &&
        (r.phase > p.phase || (p.stage !== "playing" && p.stage !== "paused"))
      ) {
        this.phaseAge = 0;
        cues.push("awaken");
        burst(b.x, b.y - 30, 24, true);
      }
    }
    for (const [i, pillar] of r.pillars.entries()) {
      if (pillar.broken && !this.broken.has(i)) {
        this.crashAge = 0;
        cues.push("crash");
        burst(pillar.x, pillar.y, 20);
        burst(b.x, b.y - 25, 16, true);
      }
      if (pillar.broken) this.broken.add(i);
      else this.broken.delete(i);
    }
    for (const w of r.warnings)
      if (!this.seenWarnings.has(w.id)) {
        this.seenWarnings.add(w.id);
        if (w.kind === "slam") this.pendingSlams.set(w.id, w.at);
        if (w.kind === "charge") cues.push("charge");
        if (w.kind === "debris") this.pendingDebris.set(w.id, w);
        if (
          w.kind !== "debris" ||
          !r.warnings.some((v) => v.kind === "debris" && v.id < w.id)
        ) {
          cues.push("roar");
          if (w.kind === "debris") cues.push("debris");
        }
      }
    // Cancelled telegraphs (stagger, phase transition, defeat) never cause a fake slam.
    for (const [id, at] of this.pendingSlams) {
      if (!r.warnings.some((w) => w.id === id)) {
        if (
          live &&
          state.time >= at &&
          state.time - at < 0.3 &&
          r.staggerUntil <= state.time
        ) {
          this.slamAge = 0;
          cues.push("slam");
          burst(b.x, b.y + 40, 18);
        }
        this.pendingSlams.delete(id);
      }
    }
    for (const [id, w] of this.pendingDebris)
      if (!r.warnings.some((v) => v.id === id)) {
        if (
          live &&
          state.time >= w.at &&
          state.time - w.at < 0.3 &&
          r.staggerUntil <= state.time
        ) {
          if (!cues.includes("debris-hit")) cues.push("debris-hit");
          burst(w.x, w.y, 7);
        }
        this.pendingDebris.delete(id);
      }
    const dead = r.result === "victory";
    if (dead) {
      if (this.deathAge === 0) {
        cues.push("fall");
        burst(b.x, b.y - 20, 24);
      }
      this.deathAge += dt || 0.00001;
    }
    const charging = live && this.speed > 180 && r.staggerUntil <= state.time;
    if (charging) {
      this.strideAge += dt;
      if (this.strideAge > 0.26) {
        this.strideAge %= 0.26;
        cues.push("step");
        burst(b.x, b.y + 45, 2);
      }
    } else this.strideAge = 0;
    this.fragments = this.fragments.filter((v) => (v.age += dt) < v.life);
    const slam = r.warnings.find((w) => w.kind === "slam");
    // Volleys wind up like a charge; eruptions and meteors like debris.
    const debris = r.warnings.find(
      (w) => w.kind === "debris" || w.kind === "eruption" || w.kind === "share",
    );
    const charge = r.warnings.find(
      (w) => w.kind === "charge" || w.kind === "volley",
    );
    const progress = (w: typeof slam) =>
      w
        ? clamp(
            (state.time - (w.startedAt ?? w.at - 1.5)) /
              Math.max(0.01, w.at - (w.startedAt ?? w.at - 1.5)),
          )
        : 0;
    const collapse = dead
      ? reduced
        ? 1
        : clamp((this.deathAge - 1.05) / 1.2)
      : 0;
    this.previous = {
      time: state.time,
      x: b.x,
      y: b.y,
      hp: b.hp,
      phase: r.phase,
      stage: state.phase,
      seed: r.seed,
      result: r.result,
    };
    // Keep bookkeeping bounded for endless/restarted local playtests.
    if (this.seenWarnings.size > 200)
      this.seenWarnings = new Set(r.warnings.map((w) => w.id));
    return {
      time: this.time,
      cues,
      charging,
      charge: progress(charge),
      slam: progress(slam),
      debris: progress(debris),
      hurt: clamp(1 - this.hurtAge / 0.24),
      transform: clamp(1 - this.phaseAge / 1.6),
      impact: clamp(1 - this.slamAge / 0.55),
      crash: clamp(1 - this.crashAge / 0.65),
      deathAge: this.deathAge,
      dead,
      collapse,
      fragments: this.fragments,
    };
  }
}
