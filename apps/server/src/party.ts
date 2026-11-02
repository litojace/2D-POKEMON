import { randomInt } from "node:crypto";

/**
 * Parties before a room (hub redesign phase 2b). Friends gather on the Lobby
 * stage, then the leader's PLAY opens a room and the others follow it in.
 * Kept in memory like rooms: a server restart ends every party.
 */
export const PARTY_SIZE = 4;
export const PARTY_INVITE_MS = 90_000;
export const PARTY_INVITE_COOLDOWN_MS = 30_000;
export interface PartyMember {
  id: string;
  name: string;
  character: string;
}
export interface Party {
  /** Six characters, so an invitation looks like a room invitation. */
  code: string;
  leader: string;
  members: PartyMember[];
}
interface Invite {
  code: string;
  fromId: string;
  toId: string;
  expiresAt: number;
}
type Result<T> = { ok: true } & T;
type Failure = { ok: false; error: string };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class Parties {
  private parties = new Map<string, Party>();
  private byAccount = new Map<string, string>();
  private invites = new Map<string, Invite>();
  private cooldowns = new Map<string, number>();

  of(accountId: string) {
    const code = this.byAccount.get(accountId);
    return code ? this.parties.get(code) : undefined;
  }
  size() {
    return this.parties.size;
  }
  private newCode() {
    for (;;) {
      let code = "";
      for (let i = 0; i < 6; i++)
        code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!this.parties.has(code)) return code;
    }
  }
  private prune(now: number) {
    for (const [key, invite] of this.invites)
      if (invite.expiresAt <= now || !this.parties.has(invite.code))
        this.invites.delete(key);
    for (const [key, until] of this.cooldowns)
      if (until <= now) this.cooldowns.delete(key);
  }
  /**
   * Invite `toId` to the sender's party, creating it with the sender as
   * leader. Callers check friendship, presence and rooms first.
   */
  invite(
    from: PartyMember,
    toId: string,
    now: number,
  ): Result<{ party: Party; created: boolean; expiresAt: number }> | Failure {
    this.prune(now);
    if (toId === from.id) return { ok: false, error: "Invite a friend." };
    const key = `${from.id}:${toId}`;
    if (this.cooldowns.has(key))
      return {
        ok: false,
        error: "Invite already sent. Give your friend a moment.",
      };
    let party = this.of(from.id),
      created = false;
    if (party?.members.some((m) => m.id === toId))
      return { ok: false, error: "Your friend is already in your party." };
    if (party && party.members.length >= PARTY_SIZE)
      return { ok: false, error: `A party has at most ${PARTY_SIZE} players.` };
    if (this.cooldowns.size >= 2000)
      return { ok: false, error: "Try inviting again in a moment." };
    if (!party) {
      party = { code: this.newCode(), leader: from.id, members: [{ ...from }] };
      this.parties.set(party.code, party);
      this.byAccount.set(from.id, party.code);
      created = true;
    }
    const expiresAt = now + PARTY_INVITE_MS;
    this.invites.set(`${party.code}:${toId}`, {
      code: party.code,
      fromId: from.id,
      toId,
      expiresAt,
    });
    this.cooldowns.set(key, now + PARTY_INVITE_COOLDOWN_MS);
    return { ok: true, party, created, expiresAt };
  }
  /** Join a party you were invited to; leaves any party you were in. */
  accept(
    member: PartyMember,
    code: string,
    now: number,
  ): Result<{ party: Party; left?: Party; disbanded?: Party }> | Failure {
    this.prune(now);
    const invite = this.invites.get(`${code}:${member.id}`),
      party = this.parties.get(code);
    if (!invite || !party)
      return { ok: false, error: "This invitation has expired." };
    if (party.members.some((m) => m.id === member.id)) {
      this.invites.delete(`${code}:${member.id}`);
      return { ok: true, party };
    }
    if (party.members.length >= PARTY_SIZE)
      return { ok: false, error: "That party is full." };
    const previous = this.leave(member.id);
    party.members.push({ ...member });
    this.byAccount.set(member.id, code);
    this.invites.delete(`${code}:${member.id}`);
    return {
      ok: true,
      party,
      left: previous?.party,
      disbanded: previous?.disbanded,
    };
  }
  decline(accountId: string, code: string) {
    const invite = this.invites.get(`${code}:${accountId}`);
    this.invites.delete(`${code}:${accountId}`);
    return invite;
  }
  /**
   * Leave your party. The next member leads if the leader leaves; a party of
   * one ends. Returns the party that remains (or ended) for broadcasting.
   */
  leave(accountId: string): { party: Party; disbanded?: Party } | undefined {
    const party = this.of(accountId);
    if (!party) return undefined;
    party.members = party.members.filter((m) => m.id !== accountId);
    this.byAccount.delete(accountId);
    if (party.leader === accountId && party.members[0])
      party.leader = party.members[0].id;
    if (party.members.length <= 1) {
      for (const m of party.members) this.byAccount.delete(m.id);
      this.parties.delete(party.code);
      for (const [key, invite] of this.invites)
        if (invite.code === party.code) this.invites.delete(key);
      return { party, disbanded: party };
    }
    return { party };
  }
  /** The fighter a member stands as on the others' Lobby stage. */
  setCharacter(accountId: string, character: string) {
    const party = this.of(accountId),
      member = party?.members.find((m) => m.id === accountId);
    if (!member || member.character === character) return undefined;
    member.character = character;
    return party;
  }
}
