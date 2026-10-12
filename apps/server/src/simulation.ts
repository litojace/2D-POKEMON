import {
  CHARACTERS,
  RULES,
  STATUS_RULES,
  advanceMovement,
  blankInput,
  blocked,
  move,
  normalize,
  type Ability,
  type CharacterId,
  type Fighter,
  type GameEvent,
  type Input,
  type Phase,
  type Projectile,
  type Snapshot,
  type StatusKind,
  type Zone,
} from "../../../packages/shared/src/index.js";
export class Arena {
  practice: Snapshot["practice"] = null;
  nextPracticeZone = 0;
  time = 0;
  phase: Phase = "lobby";
  previousPhase: Phase = "playing";
  deadline = 0;
  round = 1;
  scores: Record<string, number> = {};
  winner: string | null = null;
  roundWinner: string | null = null;
  overtime = false;
  players: Fighter[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  events: GameEvent[] = [];
  serial = 0;
  constructor(public code: string) {}
  add(id: string, name: string, character: CharacterId = "voltling"): Fighter {
    const p: Fighter = {
      id,
      name,
      character,
      connected: true,
      ready: false,
      hp: CHARACTERS[character].health,
      x: 260,
      y: 450,
      vx: 0,
      vy: 0,
      angle: 0,
      ack: 0,
      cooldowns: [0, 0, 0, 0],
      basicAt: 0,
      dashAt: 0,
      jumpAt: 0,
      dashUntil: 0,
      jumpUntil: 0,
      dashX: 0,
      dashY: 0,
      statuses: [],
      immuneUntil: 0,
      recoveryUntil: 0,
      stats: { dealt: 0, received: 0, skills: 0 },
      lastInput: blankInput(),
    };
    this.players.push(p);
    this.scores[id] = 0;
    return p;
  }
  event(
    kind: GameEvent["kind"],
    p: { x: number; y: number },
    color: number,
    value?: number,
    owner?: string,
  ) {
    this.events.push({
      id: ++this.serial,
      kind,
      x: p.x,
      y: p.y,
      color,
      value,
      owner,
    });
    if (this.events.length > 80) this.events.shift();
  }
  start() {
    this.scores = Object.fromEntries(this.players.map((p) => [p.id, 0]));
    this.round = 1;
    this.winner = null;
    this.roundWinner = null;
    for (const p of this.players)
      p.stats = { dealt: 0, received: 0, skills: 0 };
    this.resetRound();
  }
  resetPractice() {
    this.start();
    this.phase = "playing";
    this.deadline = 0;
    this.players[0].x = 650;
    this.players[0].y = 180;
    this.players[1].x = 950;
    this.players[1].y = 180;
    this.nextPracticeZone = this.time + 3;
  }
  resetRound() {
    this.projectiles = [];
    this.zones = [];
    this.overtime = false;
    for (const [i, p] of this.players.entries()) {
      Object.assign(p, {
        hp: CHARACTERS[p.character].health,
        x: i === 0 ? 260 : 1340,
        y: 450,
        vx: 0,
        vy: 0,
        angle: i === 0 ? 0 : Math.PI,
        cooldowns: [0, 0, 0, 0],
        basicAt: 0,
        dashAt: 0,
        jumpAt: 0,
        dashUntil: 0,
        jumpUntil: 0,
        statuses: [],
        immuneUntil: 0,
        recoveryUntil: 0,
        charge: undefined,
        rush: undefined,
        clone: undefined,
        lastInput: blankInput(),
      });
    }
    this.phase = "countdown";
    this.deadline = this.time + RULES.countdown;
  }
  submit(p: Fighter, input: Input) {
    if (this.phase !== "playing" || input.seq <= p.ack) return;
    p.ack = input.seq;
    p.lastInput = {
      ...input,
      basic: input.basic || p.lastInput.basic,
      dash: input.dash || p.lastInput.dash,
      jump: input.jump || p.lastInput.jump,
      skill: input.skill >= 0 ? input.skill : p.lastInput.skill,
    };
  }
  status(p: Fighter, kind: StatusKind, duration: number) {
    if (["stun", "freeze", "paralysis"].includes(kind)) {
      if (this.time < p.immuneUntil) return;
      p.immuneUntil = this.time + duration + STATUS_RULES.crowdControlImmunity;
    }
    const old = p.statuses.find((s) => s.kind === kind);
    if (old) old.until = Math.max(old.until, this.time + duration);
    else
      p.statuses.push({
        kind,
        until: this.time + duration,
        nextTick: this.time + STATUS_RULES.burnInterval,
      });
  }
  damage(target: Fighter, amount: number, owner: string, ability?: Ability) {
    if (target.hp <= 0 || this.phase !== "playing") return;
    if (ability?.ground && target.jumpUntil > this.time) return;
    const source = this.players.find((p) => p.id === owner);
    const counter = target.statuses.some(
      (s) => s.kind === "shield" && s.until > this.time,
    );
    let dealt = counter ? amount * STATUS_RULES.shieldReduction : amount;
    dealt = Math.min(target.hp, dealt);
    target.hp = Math.max(0, target.hp - dealt);
    target.stats.received += dealt;
    if (source) source.stats.dealt += dealt;
    this.event(
      "hit",
      target,
      CHARACTERS[target.character].color,
      Math.round(dealt),
    );
    if (counter && source && source.hp > 0) {
      const reflected = Math.min(
        source.hp,
        amount * STATUS_RULES.counterReflection,
      );
      source.hp -= reflected;
      source.stats.received += reflected;
      target.stats.dealt += reflected;
      this.event(
        "hit",
        source,
        CHARACTERS[target.character].color,
        Math.round(reflected),
      );
    }
    if (ability?.status)
      this.status(target, ability.status, ability.statusDuration ?? 1);
    if (ability && source && ability.knockback) {
      const dir = normalize(target.x - source.x, target.y - source.y);
      move(target, dir.x * ability.knockback, dir.y * ability.knockback);
    }
  }
  cast(p: Fighter, a: Ability) {
    const color = CHARACTERS[p.character].color;
    const angle = p.angle;
    const enemy = this.players.find((o) => o.id !== p.id);
    this.event("cast", p, color, undefined, p.id);
    const projectile = (offset: number) => {
      if (this.projectiles.length >= RULES.maxProjectiles) return;
      this.projectiles.push({
        id: ++this.serial,
        owner: p.id,
        x: p.x + Math.cos(angle + offset) * 30,
        y: p.y + Math.sin(angle + offset) * 30,
        vx: Math.cos(angle + offset) * a.speed,
        vy: Math.sin(angle + offset) * a.speed,
        remaining: a.range,
        ability: a,
        color,
      });
    };
    if (a.kind === "projectile" || a.kind === "charged") projectile(0);
    if (a.kind === "barrage")
      for (let i = 0; i < (a.count ?? 5); i++)
        projectile((i - ((a.count ?? 5) - 1) / 2) * 0.11);
    if (a.kind === "zone" && this.zones.length < RULES.maxZones) {
      const aim = p.lastInput;
      const distance = Math.min(
        a.range,
        Math.hypot(aim.aimX - p.x, aim.aimY - p.y),
      );
      const x = p.x + Math.cos(angle) * distance,
        y = p.y + Math.sin(angle) * distance;
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x,
        y,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time + 0.35,
        ability: a,
        color,
      });
    }
    if (a.kind === "melee" && enemy) {
      const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      const dot = Math.cos(Math.atan2(enemy.y - p.y, enemy.x - p.x) - angle);
      if (distance < a.range && dot > 0.35 && this.lineClear(p, enemy))
        this.damage(enemy, a.damage, p.id, a);
    }
    if (a.kind === "movement") {
      p.dashUntil = this.time + a.duration;
      p.dashX = (Math.cos(angle) * a.range) / a.duration;
      p.dashY = (Math.sin(angle) * a.range) / a.duration;
      p.rush = { until: p.dashUntil, damage: a.damage, hit: false };
    }
    if (a.kind === "counter") this.status(p, "shield", a.duration);
    if (a.kind === "clone") {
      p.clone = { x: p.x, y: p.y, until: this.time + a.duration };
      this.status(p, "haste", a.statusDuration ?? 2);
    }
  }
  lineClear(a: { x: number; y: number }, b: { x: number; y: number }) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
    for (let i = 1; i < steps; i++)
      if (
        blocked(
          a.x + ((b.x - a.x) * i) / steps,
          a.y + ((b.y - a.y) * i) / steps,
          2,
        )
      )
        return false;
    return true;
  }
  tick(dt = 1 / RULES.tick) {
    if (
      this.phase === "paused" ||
      this.phase === "lobby" ||
      this.phase === "finished"
    )
      return;
    this.time += dt;
    if (this.phase === "countdown" || this.phase === "intermission") {
      if (this.time >= this.deadline) {
        if (this.phase === "intermission") {
          this.round++;
          this.resetRound();
        } else {
          this.phase = "playing";
          this.deadline = this.time + RULES.roundSeconds;
        }
      }
      return;
    }
    if (this.practice) {
      const [human, target] = this.players;
      target.lastInput = {
        ...blankInput(),
        aimX: human.x,
        aimY: human.y,
        basic: this.practice.targetAttacks,
      };
      target.angle = Math.atan2(human.y - target.y, human.x - target.x);
      if (this.practice.unlimitedCooldowns) {
        human.cooldowns = [0, 0, 0, 0];
        human.dashAt = 0;
        human.jumpAt = 0;
      }
      if (this.practice.targetAttacks && this.time >= this.nextPracticeZone) {
        this.nextPracticeZone = this.time + 3;
        this.cast(target, CHARACTERS.emberwing.skills[1]);
      }
    }
    for (const p of this.players) {
      p.statuses = p.statuses.filter((s) => s.until > this.time);
      for (const s of p.statuses)
        if (s.kind === "burn" && this.time >= s.nextTick) {
          s.nextTick += STATUS_RULES.burnInterval;
          this.damage(
            p,
            STATUS_RULES.burnDamage,
            this.players.find((o) => o.id !== p.id)?.id ?? "",
          );
        }
      const input = p.lastInput;
      const freeCooldowns =
        !!this.practice?.unlimitedCooldowns && p === this.players[0];
      if (p.jumpUntil > this.time - dt && p.jumpUntil <= this.time)
        this.event("land", p, CHARACTERS[p.character].color, undefined, p.id);
      const disabled = p.statuses.some(
        (s) => s.kind === "stun" || s.kind === "freeze",
      );
      if (input.dash && !disabled && this.time >= p.dashAt) {
        const d = normalize(input.dx, input.dy);
        p.dashX = (d.x || d.y ? d.x : Math.cos(p.angle)) * RULES.dashSpeed;
        p.dashY = (d.x || d.y ? d.y : Math.sin(p.angle)) * RULES.dashSpeed;
        p.dashUntil = this.time + RULES.dashDuration;
        p.dashAt = freeCooldowns ? 0 : this.time + RULES.dashCooldown;
        this.event("dash", p, CHARACTERS[p.character].color, undefined, p.id);
      }
      if (
        input.jump &&
        !disabled &&
        this.time >= p.jumpAt &&
        this.time >= p.jumpUntil
      ) {
        p.jumpUntil = this.time + RULES.jumpDuration;
        p.jumpAt = freeCooldowns ? 0 : this.time + RULES.jumpCooldown;
        this.event("jump", p, CHARACTERS[p.character].color, undefined, p.id);
      }
      advanceMovement(p, input, dt, this.time);
      if (p.charge && this.time >= p.charge.at) {
        this.cast(p, CHARACTERS[p.character].skills[p.charge.skill]);
        p.charge = undefined;
      }
      if (!disabled && this.time >= p.recoveryUntil && !p.charge) {
        const character = CHARACTERS[p.character];
        if (input.skill >= 0 && this.time >= p.cooldowns[input.skill]) {
          const a = character.skills[input.skill];
          p.cooldowns[input.skill] = freeCooldowns ? 0 : this.time + a.cooldown;
          p.stats.skills++;
          p.recoveryUntil = this.time + a.cast + a.recovery;
          if (a.cast) p.charge = { at: this.time + a.cast, skill: input.skill };
          else this.cast(p, a);
        } else if (input.basic && this.time >= p.basicAt) {
          p.basicAt = this.time + character.basic.cooldown;
          p.recoveryUntil = this.time + character.basic.recovery;
          this.cast(p, character.basic);
        }
      }
      input.dash = false;
      input.basic = false;
      input.jump = false;
      input.skill = -1;
      if (p.clone && p.clone.until <= this.time) p.clone = undefined;
      if (p.rush) {
        const enemy = this.players.find((o) => o.id !== p.id);
        if (
          enemy &&
          !p.rush.hit &&
          p.rush.damage > 0 &&
          Math.hypot(p.x - enemy.x, p.y - enemy.y) < 60
        ) {
          this.damage(enemy, p.rush.damage, p.id);
          p.rush.hit = true;
        }
        if (p.rush.until < this.time) p.rush = undefined;
      }
    }
    // Swept substeps prevent fast projectiles from tunneling through a fighter or wall.
    this.projectiles = this.projectiles.filter((pr) => {
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 10),
      );
      const enemy = this.players.find((p) => p.id !== pr.owner);
      const explode = () => {
        this.event("cast", pr, pr.color);
        if (
          pr.ability.explosion &&
          enemy &&
          Math.hypot(pr.x - enemy.x, pr.y - enemy.y) <
            pr.ability.explosion + RULES.radius &&
          this.lineClear(pr, enemy)
        )
          this.damage(enemy, pr.ability.damage, pr.owner, pr.ability);
      };
      for (let i = 0; i < steps; i++) {
        pr.x += (pr.vx * dt) / steps;
        pr.y += (pr.vy * dt) / steps;
        pr.remaining -= (Math.hypot(pr.vx, pr.vy) * dt) / steps;
        if (blocked(pr.x, pr.y, pr.ability.radius) || pr.remaining <= 0) {
          explode();
          return false;
        }
        if (
          enemy?.clone &&
          Math.hypot(pr.x - enemy.clone.x, pr.y - enemy.clone.y) <
            RULES.radius + pr.ability.radius
        ) {
          enemy.clone = undefined;
          this.event("cast", pr, pr.color);
          return false;
        }
        if (
          enemy &&
          Math.hypot(pr.x - enemy.x, pr.y - enemy.y) <
            RULES.radius + pr.ability.radius
        ) {
          if (pr.ability.explosion) explode();
          else this.damage(enemy, pr.ability.damage, pr.owner, pr.ability);
          return false;
        }
      }
      return true;
    });
    for (const zone of this.zones)
      if (this.time >= zone.nextTick) {
        zone.nextTick += 0.5;
        const enemy = this.players.find((p) => p.id !== zone.owner);
        if (
          enemy &&
          Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <
            zone.radius + RULES.radius &&
          this.lineClear(zone, enemy)
        )
          this.damage(enemy, zone.ability.damage, zone.owner, zone.ability);
      }
    this.zones = this.zones.filter((z) => z.until > this.time);
    if (this.practice) {
      for (const [i, p] of this.players.entries())
        if (p.hp <= 0) {
          p.hp = CHARACTERS[p.character].health;
          p.x = i === 0 ? 650 : 950;
          p.y = 180;
          p.vx = p.vy = 0;
          p.statuses = [];
          p.clone = undefined;
          p.charge = undefined;
          p.rush = undefined;
          p.dashUntil = p.jumpUntil = 0;
          p.lastInput = blankInput();
        }
      return;
    }
    if (this.overtime)
      for (const p of this.players)
        this.damage(
          p,
          dt * 12,
          this.players.find((o) => o.id !== p.id)?.id ?? "",
        );
    const alive = this.players.filter((p) => p.hp > 0);
    if (alive.length < 2) {
      this.endRound(alive[0]?.id ?? null);
      return;
    }
    if (this.time >= this.deadline) {
      const [a, b] = this.players;
      const diff =
        a.hp / CHARACTERS[a.character].health -
        b.hp / CHARACTERS[b.character].health;
      if (Math.abs(diff) < 0.0001) {
        this.overtime = true;
        this.deadline = this.time + 20;
      } else this.endRound(diff > 0 ? a.id : b.id);
    }
  }
  endRound(id: string | null) {
    this.roundWinner = id;
    if (id) this.scores[id]++;
    this.event("round", { x: 800, y: 450 }, 0xffffff);
    if (id && this.scores[id] >= RULES.roundsToWin) {
      this.winner = id;
      this.phase = "finished";
    } else {
      this.phase = "intermission";
      this.deadline = this.time + RULES.intermission;
    }
  }
  forfeit(id: string) {
    this.winner = id;
    this.scores[id] = RULES.roundsToWin;
    this.phase = "finished";
  }
  snapshot(pauseRemaining = 0): Snapshot {
    return {
      practice: this.practice,
      code: this.code,
      phase: this.phase,
      time: this.time,
      remaining: Math.max(0, this.deadline - this.time),
      round: this.round,
      scores: this.scores,
      winner: this.winner,
      roundWinner: this.roundWinner,
      players: this.players,
      projectiles: this.projectiles,
      zones: this.zones,
      events: this.events,
      pauseRemaining,
      overtime: this.overtime,
    };
  }
}
