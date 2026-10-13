import type { CharacterId } from "@arena/shared";

/** Keep the latest local choice visible until an authoritative snapshot agrees. */
export class LobbySelection {
  private pending?: { character: CharacterId; revision: number };
  private revision = 0;

  choose(character: CharacterId) {
    const revision = ++this.revision;
    this.pending = { character, revision };
    return revision;
  }

  reconcile(character: CharacterId, inLobby: boolean): CharacterId {
    if (!inLobby || this.pending?.character === character)
      this.pending = undefined;
    return this.pending?.character ?? character;
  }

  reject(revision: number) {
    if (this.pending?.revision !== revision) return false;
    this.pending = undefined;
    return true;
  }

  reset() {
    this.pending = undefined;
  }
}
