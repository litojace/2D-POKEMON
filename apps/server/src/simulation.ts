import {
  CHARACTERS,
  DEBUFFS,
  MODE_SIZE,
  ORB_SPOTS,
  RULES,
  SKILL_SLOTS,
  STATUS_RULES,
  basicInterval,
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
  type MatchMode,
  type Orb,
  type Phase,
  type Team,
  type Projectile,
  type Snapshot,
  type StatusKind,
  type Zone,
} from "../../../packages/shared/src/index.js";
import type { BotBrain } from "./bot.js";
export class Arena {
  practice: Snapshot["practice"] = null;
  /** AI opponents in this room, by fighter id (solo vs bot). */
  bots = new Map<string, BotBrain>();
  nextPracticeZone = 0;
  time = 0;
  phase: Phase = "lobby";
  previousPhase: Phase = "playing";
  deadline = 0;
  round = 1;
  scores: Record<string, number> = {};
  winner: string | null = null;
  roundWinner: string | null = null;
  mode: MatchMode = "duel";
  teamScores: [number, number] = [0, 0];
  winnerTeam: Team | null = null;
  roundWinnerTeam: Team | null = null;
  overtime = false;
  players: Fighter[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  orbs: Orb[] = [];
  nextOrb = 0;
  private orbTurn = 0;
  events: GameEvent[] = [];
  serial = 0;
  constructor(
    public code: string,
    mode: MatchMode = "duel",
  ) {
    this.mode = mode;
  }
  /** Round wins needed (best of five in both modes). */
  get roundsToWin() {
    return RULES.roundsToWin;
  }
  /** Players this room holds: 2 for a duel, 4 for 2v2. */
  get size() {
    return MODE_SIZE[this.mode];
  }
  teamOf(p: Fighter): Team {
    return p.team ?? (this.players.indexOf(p) % 2 === 0 ? 0 : 1);
  }
  /** Everyone on the other team who is still in the match. */
  enemiesOf(p: Fighter) {
    const team = this.teamOf(p);
    return this.players.filter(
      (o) => o !== p && this.teamOf(o) !== team && !o.out,
    );
  }
  /** Enemies of whoever owns a projectile or zone (by id). */
  enemiesOfOwner(owner: string) {
    const p = this.players.find((o) => o.id === owner);
    return p ? this.enemiesOf(p) : this.players.filter((o) => o.id !== owner);
  }
  /** Members of a team still standing this round. */
  standing(team: Team) {
    return this.players.filter(
      (p) => this.teamOf(p) === team && !p.out && p.hp > 0,
    );
  }
  add(id: string, name: string, character: CharacterId = "voltkit"): Fighter {
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
      cooldowns: Array(SKILL_SLOTS).fill(0),
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
    // Join the smaller team (a duel ends up Blue vs Red).
    const blue = this.players.filter((o) => this.teamOf(o) === 0).length;
    p.team = blue <= this.players.length - blue ? 0 : 1;
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
    abilityId?: string,
  ) {
    this.events.push({
      id: ++this.serial,
      kind,
      x: p.x,
      y: p.y,
      color,
      value,
      owner,
      abilityId,
    });
    if (this.events.length > 80) this.events.shift();
  }
  instructionsReady: string[] = [];
  acknowledgeInstructions(id: string) {
    if (
      this.phase !== "briefing" ||
      !this.players.some((p) => p.id === id && p.connected)
    )
      return false;
    if (!this.instructionsReady.includes(id)) this.instructionsReady.push(id);
    if (
      this.players.length === this.size &&
      this.players.every(
        (p) => p.out || (p.connected && this.instructionsReady.includes(p.id)),
      )
    ) {
      this.phase = "countdown";
      this.deadline = this.time + RULES.countdown;
    }
    return true;
  }
  start() {
    this.scores = Object.fromEntries(this.players.map((p) => [p.id, 0]));
    this.round = 1;
    this.winner = null;
    this.roundWinner = null;
    this.teamScores = [0, 0];
    this.winnerTeam = null;
    this.roundWinnerTeam = null;
    for (const p of this.players)
      p.stats = { dealt: 0, received: 0, skills: 0 };
    this.resetRound();
    // Bots have read the instructions; the match starts when the human confirms.
    this.instructionsReady = [...this.bots.keys()];
    this.phase = "briefing";
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
    const slot = [0, 0];
    for (const p of this.players) {
      const team = this.teamOf(p),
        index = slot[team]++;
      // Duel: one each side. 2v2: partners side by side, a lane apart.
      const y = this.mode === "teams" ? (index === 0 ? 330 : 570) : 450;
      Object.assign(p, {
        hp: p.out ? 0 : CHARACTERS[p.character].health,
        x: team === 0 ? 260 : 1340,
        y,
        vx: 0,
        vy: 0,
        angle: team === 0 ? 0 : Math.PI,
        cooldowns: Array(SKILL_SLOTS).fill(0),
        basicAt: 0,
        dashAt: 0,
        jumpAt: 0,
        dashUntil: 0,
        jumpUntil: 0,
        statuses: [],
        immuneUntil: 0,
        recoveryUntil: 0,
        charge: undefined,
        channel: undefined,
        clone: undefined,
        lastInput: blankInput(),
      });
    }
    for (const brain of this.bots.values()) brain.reset();
    this.orbs = [];
    this.orbTurn = 0;
    this.nextOrb = this.time + RULES.countdown + RULES.orbFirst;
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
  status(p: Fighter, kind: StatusKind, duration: number, by?: string) {
    if (["stun", "freeze", "paralysis"].includes(kind)) {
      if (this.time < p.immuneUntil) return;
      p.immuneUntil = this.time + duration + STATUS_RULES.crowdControlImmunity;
    }
    const old = p.statuses.find((s) => s.kind === kind);
    if (old) {
      old.until = Math.max(old.until, this.time + duration);
      if (by) old.by = by;
    } else
      p.statuses.push({
        kind,
        until: this.time + duration,
        nextTick: this.time + STATUS_RULES.burnInterval,
        ...(by ? { by } : {}),
      });
  }
  has(p: Fighter, kind: StatusKind) {
    return p.statuses.some((s) => s.kind === kind && s.until > this.time);
  }
  damage(target: Fighter, amount: number, owner: string, ability?: Ability) {
    if (target.hp <= 0 || this.phase !== "playing") return;
    if (ability?.ground && target.jumpUntil > this.time) return;
    const source = this.players.find((p) => p.id === owner);
    const counter = this.has(target, "counter");
    if (amount > 0)
      target.statuses = target.statuses.filter((s) => s.kind !== "stealth");
    let dealt = amount;
    if (ability && source && this.has(source, "empower"))
      dealt *= STATUS_RULES.empowerDamage;
    if (
      ability?.bonusVsStatus &&
      target.statuses.some(
        (s) => s.until > this.time && DEBUFFS.includes(s.kind),
      )
    )
      dealt *= ability.bonusVsStatus;
    if (counter) dealt *= STATUS_RULES.counterReduction;
    if (this.has(target, "shield")) dealt *= STATUS_RULES.shieldReduction;
    if (this.has(target, "sleep")) dealt *= STATUS_RULES.sleepVulnerability;
    dealt = Math.min(target.hp, dealt);
    target.hp = Math.max(0, target.hp - dealt);
    target.stats.received += dealt;
    if (source) source.stats.dealt += dealt;
    this.event(
      "hit",
      target,
      CHARACTERS[target.character].color,
      Math.round(dealt),
      undefined,
      ability?.id,
    );
    if (counter && source && source !== target && source.hp > 0) {
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
      this.status(target, ability.status, ability.statusDuration ?? 1, owner);
    if (ability && source && ability.knockback) {
      const dir = normalize(target.x - source.x, target.y - source.y);
      move(target, dir.x * ability.knockback, dir.y * ability.knockback);
    }
  }
  /** Enemy is in front of `p` within `range` and the cosine threshold `arc`. */
  inArc(p: Fighter, enemy: Fighter, range: number, arc: number) {
    const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    const dot = Math.cos(Math.atan2(enemy.y - p.y, enemy.x - p.x) - p.angle);
    return (
      distance < range + RULES.radius &&
      (distance < RULES.radius || dot > arc) &&
      this.lineClear(p, enemy)
    );
  }
  cast(p: Fighter, a: Ability) {
    p.statuses = p.statuses.filter((s) => s.kind !== "stealth");
    const color = CHARACTERS[p.character].color;
    const angle = p.angle;
    const enemies = this.enemiesOf(p);
    this.event("cast", p, color, undefined, p.id, a.id);
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
      const distance = a.follow
        ? 0
        : Math.min(a.range, Math.hypot(aim.aimX - p.x, aim.aimY - p.y));
      const x = p.x + Math.cos(angle) * distance,
        y = p.y + Math.sin(angle) * distance;
      this.zones.push({
        id: ++this.serial,
        owner: p.id,
        x,
        y,
        radius: a.radius,
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.35),
        ability: a,
        color,
      });
    }
    if (a.kind === "melee")
      for (const enemy of enemies)
        if (enemy.hp > 0 && this.inArc(p, enemy, a.range, a.arc ?? 0.35))
          this.damage(enemy, a.damage, p.id, a);
    if (a.kind === "nova") {
      this.event("burst", p, color, undefined, p.id, a.id);
      for (const enemy of enemies) {
        if (
          enemy.clone &&
          Math.hypot(enemy.clone.x - p.x, enemy.clone.y - p.y) < a.radius
        )
          enemy.clone = undefined;
        if (
          enemy.hp > 0 &&
          Math.hypot(enemy.x - p.x, enemy.y - p.y) < a.radius + RULES.radius &&
          this.lineClear(p, enemy)
        )
          this.damage(enemy, a.damage, p.id, a);
      }
    }
    if (a.kind === "beam") {
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      let x = p.x,
        y = p.y;
      for (let travelled = 0; travelled < a.range; travelled += 8) {
        x = p.x + dx * travelled;
        y = p.y + dy * travelled;
        if (travelled > RULES.radius && blocked(x, y, 2)) break;
        // The beam stops at the first decoy or enemy it reaches.
        const decoy = enemies.find(
          (e) =>
            e.clone &&
            Math.hypot(x - e.clone.x, y - e.clone.y) < a.radius + RULES.radius,
        );
        if (decoy) {
          decoy.clone = undefined;
          break;
        }
        const struck = enemies.find(
          (e) =>
            e.hp > 0 && Math.hypot(x - e.x, y - e.y) < a.radius + RULES.radius,
        );
        if (struck) {
          this.damage(struck, a.damage, p.id, a);
          break;
        }
      }
      this.events.push({
        id: ++this.serial,
        kind: "beam",
        x: p.x,
        y: p.y,
        tx: x,
        ty: y,
        color,
        owner: p.id,
        abilityId: a.id,
      });
      if (this.events.length > 80) this.events.shift();
    }
    if (a.kind === "cone") {
      const skill = CHARACTERS[p.character].skills.indexOf(a);
      p.channel = {
        until: this.time + a.duration,
        nextTick: this.time + (a.tickDelay ?? 0.1),
        skill,
      };
    }
    if (a.kind === "counter") this.status(p, "counter", a.duration);
    if (a.kind === "barrier") this.status(p, "shield", a.duration);
    if (a.kind === "buff") this.status(p, "empower", a.duration);
    if (a.kind === "rest") {
      this.status(p, "sleep", a.duration);
      const sleep = p.statuses.find((s) => s.kind === "sleep")!;
      sleep.amount = a.heal ?? 0;
      // Ticks land at 0.4s, 0.9s … so a full Rest always heals duration / interval times.
      sleep.nextTick = this.time + STATUS_RULES.restInterval - 0.1;
      p.channel = undefined;
    }
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
      this.phase === "briefing" ||
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
        human.cooldowns = Array(SKILL_SLOTS).fill(0);
        human.dashAt = 0;
        human.jumpAt = 0;
      }
      if (this.practice.targetAttacks && this.time >= this.nextPracticeZone) {
        this.nextPracticeZone = this.time + 3;
        this.cast(target, CHARACTERS.voltkit.skills[2]);
      }
    }
    for (const [id, brain] of this.bots) {
      const bot = this.players.find((p) => p.id === id);
      if (bot) bot.lastInput = brain.think(this, bot);
    }
    for (const p of this.players) {
      // Knocked-out (2v2) or departed fighters sit still until the next round.
      // (A duel ends the round the same tick, so this only matters in 2v2.)
      if (p.out || (p.hp <= 0 && this.mode === "teams")) {
        p.vx = p.vy = 0;
        p.charge = undefined;
        p.channel = undefined;
        p.lastInput = {
          ...blankInput(),
          aimX: p.lastInput.aimX,
          aimY: p.lastInput.aimY,
        };
        continue;
      }
      p.statuses = p.statuses.filter((s) => s.until > this.time);
      for (const s of p.statuses) {
        if (s.kind === "sleep" && s.amount && this.time >= s.nextTick) {
          s.nextTick += STATUS_RULES.restInterval;
          p.hp = Math.min(CHARACTERS[p.character].health, p.hp + s.amount);
        }
        if (s.kind === "burn" && this.time >= s.nextTick) {
          s.nextTick += STATUS_RULES.burnInterval;
          this.damage(
            p,
            STATUS_RULES.burnDamage,
            s.by ?? this.enemiesOf(p)[0]?.id ?? "",
          );
        }
      }
      const input = p.lastInput;
      const freeCooldowns =
        !!this.practice?.unlimitedCooldowns && p === this.players[0];
      if (p.jumpUntil > this.time - dt && p.jumpUntil <= this.time)
        this.event("land", p, CHARACTERS[p.character].color, undefined, p.id);
      const disabled = p.statuses.some(
        (s) => s.kind === "stun" || s.kind === "freeze" || s.kind === "sleep",
      );
      if (disabled) {
        p.charge = undefined;
        p.channel = undefined;
      }
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
          p.recoveryUntil =
            this.time +
            a.cast +
            a.recovery +
            (a.kind === "cone" ? a.duration : 0);
          if (a.cast) p.charge = { at: this.time + a.cast, skill: input.skill };
          else this.cast(p, a);
        } else if (input.basic && this.time >= p.basicAt) {
          // The interval is enforced here, so flooding inputs cannot fire faster.
          p.basicAt =
            this.time + basicInterval(character, this.has(p, "empower"));
          p.recoveryUntil = this.time + character.basic.recovery;
          this.cast(p, character.basic);
        }
      }
      input.dash = false;
      input.basic = false;
      input.jump = false;
      input.skill = -1;
      if (p.clone && p.clone.until <= this.time) p.clone = undefined;
      if (p.channel) {
        const a = CHARACTERS[p.character].skills[p.channel.skill];
        if (a && this.time >= p.channel.nextTick) {
          p.channel.nextTick += a.tickInterval ?? 0.2;
          for (const enemy of this.enemiesOf(p))
            if (enemy.hp > 0 && this.inArc(p, enemy, a.range, a.arc ?? 0.7))
              this.damage(enemy, a.damage, p.id, a);
        }
        if (!a || this.time >= p.channel.until) p.channel = undefined;
      }
    }
    // Swept substeps prevent fast projectiles from tunneling through a fighter or wall.
    this.projectiles = this.projectiles.filter((pr) => {
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 10),
      );
      const enemies = this.enemiesOfOwner(pr.owner);
      const explode = () => {
        this.event("impact", pr, pr.color, undefined, pr.owner, pr.ability.id);
        if (pr.ability.explosion)
          for (const enemy of enemies)
            if (
              enemy.hp > 0 &&
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
        const decoy = enemies.find(
          (e) =>
            e.clone &&
            Math.hypot(pr.x - e.clone.x, pr.y - e.clone.y) <
              RULES.radius + pr.ability.radius,
        );
        if (decoy) {
          decoy.clone = undefined;
          this.event(
            "impact",
            pr,
            pr.color,
            undefined,
            pr.owner,
            pr.ability.id,
          );
          return false;
        }
        const struck = enemies.find(
          (e) =>
            e.hp > 0 &&
            Math.hypot(pr.x - e.x, pr.y - e.y) <
              RULES.radius + pr.ability.radius,
        );
        if (struck) {
          if (pr.ability.explosion) explode();
          else this.damage(struck, pr.ability.damage, pr.owner, pr.ability);
          return false;
        }
      }
      return true;
    });
    for (const zone of this.zones) {
      if (zone.ability.follow) {
        const owner = this.players.find((p) => p.id === zone.owner);
        if (owner) {
          zone.x = owner.x;
          zone.y = owner.y;
        }
      }
      if (this.time >= zone.nextTick) {
        zone.nextTick += zone.ability.tickInterval ?? 0.5;
        for (const enemy of this.enemiesOfOwner(zone.owner))
          if (
            enemy.hp > 0 &&
            Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <
              zone.radius + RULES.radius &&
            this.lineClear(zone, enemy)
          )
            this.damage(enemy, zone.ability.damage, zone.owner, zone.ability);
      }
    }
    this.zones = this.zones.filter((z) => z.until > this.time);
    if (!this.practice) this.stepOrbs();
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
          p.channel = undefined;
          p.dashUntil = p.jumpUntil = 0;
          p.lastInput = blankInput();
        }
      return;
    }
    if (this.overtime)
      for (const p of this.players)
        if (p.hp > 0 && !p.out)
          this.damage(p, dt * 12, this.enemiesOf(p)[0]?.id ?? "");
    const blue = this.standing(0).length,
      red = this.standing(1).length;
    if (!blue || !red) {
      this.endRound(blue ? 0 : red ? 1 : null);
      return;
    }
    if (this.time >= this.deadline) {
      // Time: the team with more health left (as a share of its full health) wins.
      const share = (team: Team) => {
        const members = this.players.filter((p) => this.teamOf(p) === team);
        return (
          members.reduce(
            (sum, p) =>
              sum + Math.max(0, p.hp) / CHARACTERS[p.character].health,
            0,
          ) / Math.max(1, members.length)
        );
      };
      const diff = share(0) - share(1);
      if (Math.abs(diff) < 0.0001) {
        this.overtime = true;
        this.deadline = this.time + 20;
      } else this.endRound(diff > 0 ? 0 : 1);
    }
  }
  /** Spawn healing orbs on schedule; the first fighter to touch one heals. */
  stepOrbs() {
    if (this.time >= this.nextOrb) {
      this.nextOrb += RULES.orbInterval;
      // Duel: one orb, alternating spots. 2v2: one at each spot.
      const spots =
        this.mode === "teams"
          ? ORB_SPOTS
          : [ORB_SPOTS[this.orbTurn++ % ORB_SPOTS.length]];
      for (const spot of spots)
        if (!this.orbs.some((o) => o.x === spot.x && o.y === spot.y)) {
          this.orbs.push({ id: ++this.serial, x: spot.x, y: spot.y });
          this.event("orb", spot, 0x7dffb0);
        }
    }
    this.orbs = this.orbs.filter((orb) => {
      // Closest living fighter in reach takes it.
      const taker = this.players
        .filter(
          (p) =>
            p.hp > 0 &&
            !p.out &&
            // Full health walks straight through, leaving it for later.
            p.hp < CHARACTERS[p.character].health &&
            Math.hypot(p.x - orb.x, p.y - orb.y) <
              RULES.radius + RULES.orbRadius,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - orb.x, a.y - orb.y) -
            Math.hypot(b.x - orb.x, b.y - orb.y),
        )[0];
      if (!taker) return true;
      const full = CHARACTERS[taker.character].health;
      const healed = Math.min(
        full - taker.hp,
        Math.round(full * RULES.orbHeal),
      );
      taker.hp += healed;
      this.event("heal", taker, 0x7dffb0, healed, taker.id);
      return false;
    });
  }
  /** A team (or nobody, on a double knockout) takes the round. */
  endRound(team: Team | null) {
    const members =
      team === null ? [] : this.players.filter((p) => this.teamOf(p) === team);
    this.roundWinnerTeam = team;
    this.roundWinner =
      members.find((p) => !p.out)?.id ?? members[0]?.id ?? null;
    if (team !== null) {
      this.teamScores[team]++;
      for (const p of members) this.scores[p.id]++;
    }
    this.event("round", { x: 800, y: 450 }, 0xffffff);
    if (team !== null && this.teamScores[team] >= this.roundsToWin) {
      this.winnerTeam = team;
      this.winner = this.roundWinner;
      this.phase = "finished";
    } else {
      this.phase = "intermission";
      this.deadline = this.time + RULES.intermission;
    }
  }
  /** End the match in favour of `id`'s team (opponents left or gave up). */
  forfeit(id: string) {
    const winner = this.players.find((p) => p.id === id);
    const team = winner ? this.teamOf(winner) : 0;
    this.winner = id;
    this.winnerTeam = team;
    this.teamScores[team] = this.roundsToWin;
    for (const p of this.players)
      if (this.teamOf(p) === team) this.scores[p.id] = this.roundsToWin;
    this.phase = "finished";
  }
  snapshot(pauseRemaining = 0): Snapshot {
    return {
      instructionsReady: this.instructionsReady,
      practice: this.practice,
      vsBot: [...this.bots.values()][0]?.difficulty ?? null,
      code: this.code,
      phase: this.phase,
      time: this.time,
      remaining: Math.max(0, this.deadline - this.time),
      round: this.round,
      scores: this.scores,
      winner: this.winner,
      roundWinner: this.roundWinner,
      mode: this.mode,
      teamScores: this.teamScores,
      winnerTeam: this.winnerTeam,
      roundWinnerTeam: this.roundWinnerTeam,
      players: this.players,
      projectiles: this.projectiles,
      zones: this.zones,
      orbs: this.orbs,
      events: this.events,
      pauseRemaining,
      overtime: this.overtime,
    };
  }
}
