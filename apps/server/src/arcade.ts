import { Arena } from "./simulation.js";
import {
  ARCADE_EVENTS,
  type ArcadeId,
  type ArcadeState,
} from "../../../packages/shared/src/arcade.js";
import {
  CROWN,
  RULES,
  normalize,
  type Fighter,
  type Input,
  type MatchMode,
} from "../../../packages/shared/src/index.js";

/** Weekly rules are fixed by the server, including during retries. */
export class ArcadeArena extends Arena {
  override arcade: ArcadeState;
  private nextMeteor = 0;
  constructor(
    code: string,
    id: ArcadeId,
    week: string,
    mode: MatchMode = "duel",
  ) {
    super(code, mode);
    this.arcade = { id, week };
    this.mutators = new Set(ARCADE_EVENTS[id].mutators);
  }
  override start() {
    this.rotateArenas = false;
    this.arenaId = "conductor-ring";
    this.arcade.meteors = [];
    this.nextMeteor = 0;
    super.start();
  }
  override get crownZone() {
    if (this.arcade.id !== "crown-chase") return super.crownZone;
    const t = Math.max(0, this.time - this.hazardClock),
      index = Math.floor(t / 15) % 4;
    const p = [
      { x: 800, y: 260 },
      { x: 1180, y: 450 },
      { x: 800, y: 640 },
      { x: 420, y: 450 },
    ][index];
    return { ...p, radius: CROWN.radius, holdSeconds: 18 };
  }
  override chargeUlt(p: Fighter, amount: number) {
    super.chargeUlt(
      p,
      amount * (this.arcade.id === "ultimate-overload" ? 4 : 1),
    );
  }
  override resetRound() {
    this.arcade.meteors = [];
    this.nextMeteor = 0;
    super.resetRound();
  }
  override botInput(bot: Fighter, input: Input) {
    const danger = this.arcade.meteors?.find(
      (m) =>
        Math.hypot(bot.x - m.x, bot.y - m.y) < m.radius + RULES.radius + 30,
    );
    if (danger) {
      const d = normalize(bot.x - danger.x || 1, bot.y - danger.y);
      input.dx = d.x;
      input.dy = d.y;
      return input;
    }
    if (this.arcade.id === "crown-chase") {
      const h = this.crownZone;
      const d = normalize(h.x - bot.x, h.y - bot.y);
      const inside = Math.hypot(bot.x - h.x, bot.y - h.y) < h.radius * 0.6;
      input.dx = inside ? 0 : d.x;
      input.dy = inside ? 0 : d.y;
    }
    return input;
  }
  override tick(dt = 1 / RULES.tick) {
    if (this.phase === "playing" && this.arcade.id === "meteor-mayhem") {
      if (this.time >= this.nextMeteor) {
        this.nextMeteor = this.time + 3.2;
        const targets = this.players.filter((p) => p.hp > 0 && !p.out);
        const target = targets[Math.floor(this.random() * targets.length)];
        const spots = [
          { x: 250 + this.random() * 1100, y: 180 + this.random() * 540 },
          ...(target ? [target] : []),
        ];
        for (const p of spots)
          this.arcade.meteors!.push({
            id: ++this.serial,
            x: p.x,
            y: p.y,
            radius: 95,
            at: this.time + 1.3,
          });
      }
      this.arcade.meteors = this.arcade.meteors!.filter((m) => {
        if (m.at > this.time + dt) return true;
        for (const p of this.players)
          if (
            p.hp > 0 &&
            !p.out &&
            p.jumpUntil <= this.time &&
            Math.hypot(p.x - m.x, p.y - m.y) <= m.radius + RULES.radius
          )
            this.damage(p, 28, "");
        this.event("raid-impact", m, 0xffa17c);
        this.events[this.events.length - 1].raidRadius = m.radius;
        return false;
      });
    }
    super.tick(dt);
  }
  override snapshot(remaining = 0) {
    if (this.arcade.id === "crown-chase")
      this.arcade.hill = {
        ...this.crownZone,
        target: 18,
        movesIn: 15 - (Math.max(0, this.time - this.hazardClock) % 15),
      };
    return { ...super.snapshot(remaining), arcade: this.arcade };
  }
}
