import type { Snapshot, Vec } from "../../../../packages/shared/src/index";
type Pose = Vec & { angle: number };
type Frame = { time: number; received: number; players: Record<string, Pose> };
/** Render remote positions 100ms behind the server timeline to absorb jitter. */
export class InterpolationBuffer {
  frames: Frame[] = [];
  private offset = 0;
  private playhead = -Infinity;
  clear() {
    this.frames = [];
    this.offset = 0;
    this.playhead = -Infinity;
  }
  add(state: Snapshot, received: number) {
    this.frames.push({
      time: state.time,
      received,
      players: Object.fromEntries(
        state.players.map((p) => [p.id, { x: p.x, y: p.y, angle: p.angle }]),
      ),
    });
    if (this.frames.length > 12) this.frames.shift();
    // A late packet must not reset the render clock backwards. Use the least
    // delayed arrival in the recent window as the server/client clock offset.
    this.offset = Math.min(
      ...this.frames.map((frame) => frame.received - frame.time * 1000),
    );
  }
  sample(id: string, now: number, delay = 0.1): Pose | undefined {
    const last = this.frames.at(-1);
    if (!last) return;
    const target = Math.max(
      this.playhead,
      Math.min(last.time, (now - this.offset) / 1000 - delay),
    );
    this.playhead = target;
    let before = this.frames[0],
      after = last;
    for (const frame of this.frames) {
      if (frame.time <= target) before = frame;
      if (frame.time >= target) {
        after = frame;
        break;
      }
    }
    const a = before.players[id],
      b = after.players[id];
    if (!a || !b) return last.players[id];
    const ratio =
      after.time > before.time
        ? Math.max(
            0,
            Math.min(1, (target - before.time) / (after.time - before.time)),
          )
        : 1;
    const angleDelta = Math.atan2(
      Math.sin(b.angle - a.angle),
      Math.cos(b.angle - a.angle),
    );
    return {
      x: a.x + (b.x - a.x) * ratio,
      y: a.y + (b.y - a.y) * ratio,
      angle: a.angle + angleDelta * ratio,
    };
  }
}
