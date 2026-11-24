import {
  type Fighter,
  type Snapshot,
} from "../../../packages/shared/src/index";

/** A knocked-out participant keeps their seat and automatically follows a survivor. */
export class PvpSpectator {
  private key = "";
  private selected = "";
  candidates(state: Snapshot, myId: string): Fighter[] {
    const me = state.players.find((p) => p.id === myId);
    if (
      !me ||
      (me.hp > 0 && !me.out) ||
      state.phase !== "playing" ||
      state.raid ||
      state.practice
    )
      return [];
    const alive = state.players.filter(
      (p) => p.hp > 0 && !p.out && p.id !== myId,
    );
    if (state.mode === "teams") {
      const allies = alive.filter((p) => (p.team ?? 0) === (me.team ?? 0));
      if (allies.length) return allies;
    }
    return alive;
  }
  target(state: Snapshot, myId: string): Fighter | undefined {
    const key = `${state.code}:${state.round}:${myId}`;
    const candidates = this.candidates(state, myId);
    if (key !== this.key || !candidates.length) this.selected = "";
    this.key = key;
    const target =
      candidates.find((p) => p.id === this.selected) ?? candidates[0];
    this.selected = target?.id ?? "";
    return target;
  }
  cycle(state: Snapshot, myId: string, direction: number) {
    const current = this.target(state, myId),
      candidates = this.candidates(state, myId);
    if (!current) return;
    const index = candidates.findIndex((p) => p.id === current.id);
    this.selected =
      candidates[
        (index + direction + candidates.length) % candidates.length
      ].id;
  }
}
