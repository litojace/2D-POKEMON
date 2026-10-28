import type { Fighter, Snapshot } from "@arena/shared";

export type BossView = "front" | "back" | "left" | "right";
const axes: Record<BossView, [number, number]> = {
  front: [0, 1],
  back: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

/** Screen-space turnarounds: down faces the camera, up shows the back. */
export function bossView(x: number, y: number, previous?: BossView): BossView {
  const length = Math.hypot(x, y);
  if (length < 0.001) return previous ?? "front";
  x /= length;
  y /= length;
  const next =
    Math.abs(y) > Math.abs(x)
      ? y > 0
        ? "front"
        : "back"
      : x > 0
        ? "right"
        : "left";
  if (previous && next !== previous) {
    const a = axes[next],
      b = axes[previous];
    // A small angular margin prevents diagonal paths flickering between views.
    if (x * a[0] + y * a[1] - x * b[0] - y * b[1] < 0.16) return previous;
  }
  return next;
}

/** Movement owns the heading while travelling; live attacks own the aim.
 * Samples server positions once, so render rate cannot change the heading. */
export class BossFacing {
  private view: BossView = "front";
  private x = 0;
  private y = 0;
  private time = -1;
  private movedAt = -Infinity;
  private turnedAt = -Infinity;
  private dx = 0;
  private dy = 1;
  private castX = 0;
  private castY = 1;
  private hasCastAim = false;

  reset(boss: Fighter, time: number) {
    this.x = boss.x;
    this.y = boss.y;
    this.time = time;
    this.dx = Math.cos(boss.angle);
    this.dy = Math.sin(boss.angle);
    this.view = bossView(this.dx, this.dy);
    this.movedAt = this.turnedAt = -Infinity;
    this.hasCastAim = false;
  }

  sample(state: Snapshot, boss: Fighter, attacking: boolean): BossView {
    if (
      state.phase === "paused" ||
      boss.hp <= 0 ||
      state.raid?.result === "victory"
    )
      return this.view;
    const dt = state.time - this.time;
    if (dt > 0) {
      const dx = boss.x - this.x,
        dy = boss.y - this.y,
        distance = Math.hypot(dx, dy);
      // A teleport/reconnect does not turn a creature toward a stale position.
      if (dt < 0.5 && distance < 180 && distance > 0.5 && distance / dt > 12) {
        this.dx = dx;
        this.dy = dy;
        this.movedAt = state.time;
      }
      this.x = boss.x;
      this.y = boss.y;
      this.time = state.time;
    }
    let aimX = Math.cos(boss.angle),
      aimY = Math.sin(boss.angle);
    if (!attacking) this.hasCastAim = false;
    else {
      // The server may keep steering its body during a locked cone/charge.
      // The actual warning geometry, not that steering angle, owns the cast.
      const warning = state.raid?.warnings
        .filter(
          (w) =>
            (!w.casterId || w.casterId === boss.id) &&
            (w.startedAt ?? w.at - 1.5) <= state.time &&
            w.at >= state.time &&
            Math.hypot(w.tx - w.x, w.ty - w.y) > 1,
        )
        // When incidental telegraphs overlap a directional attack, keep
        // the locked cone/charge facing instead of switching to a later marker.
        .sort((a, b) =>
          Number(b.kind === "wing-gust" || b.kind === "volley" || b.kind === "charge") -
            Number(a.kind === "wing-gust" || a.kind === "volley" || a.kind === "charge") ||
          a.at - b.at,
        )[0];
      if (warning) {
        this.castX = warning.tx - warning.x;
        this.castY = warning.ty - warning.y;
        this.hasCastAim = true;
      }
      if (this.hasCastAim) {
        aimX = this.castX;
        aimY = this.castY;
      }
    }
    // Continue showing the committed attack direction while its warning is active.
    const travelling = !attacking && state.time - this.movedAt < 0.35;
    const next = bossView(
      travelling ? this.dx : aimX,
      travelling ? this.dy : aimY,
      this.view,
    );
    if (next !== this.view && state.time - this.turnedAt >= 0.12) {
      this.view = next;
      this.turnedAt = state.time;
    }
    return this.view;
  }
}
