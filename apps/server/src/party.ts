import { randomInt } from "node:crypto";
import type { RaidLoadout } from "../../../packages/shared/src/raid.js";
import type { ChampionLook } from "../../../packages/shared/src/shop.js";

/**
 * Parties before a room (hub redesign phase 2b). Friends gather on the Lobby
 * stage, then the leader's PLAY opens a room and the others follow it in.
 * Kept in memory like rooms: a server restart ends every party.
 */
export const PARTY_SIZE = 4;
export const PARTY_INVITE_MS = 90_000;
export const PARTY_INVITE_COOLDOWN_MS = 30_000;
/**
 * A member whose connection dropped keeps their place this long (a phone
 * locked, an app switch, a network change) before the party lets them go,
 * like the room's own reconnect grace.
 */
export const PARTY_AWAY_MS = 60_000;
export interface PartyMember {
  id: string;
  name: string;
  character: string;
}
/**
 * A member's saved, public appearance: the Shop skin worn on each champion
 * and the equipped raid look (colours, aura, entrance, frame, victory).
 * Read from the member's own account, never taken from the client.
 */
export interface PartyAppearance {
  looks: Partial<Record<string, ChampionLook>>;
  look: RaidLoadout;
  /** Their avatar (avatars.ts); null: the default. */
  avatar?: string | null;
}
export interface Party {
  /** Six characters, so an invitation looks like a room invitation. */
  code: string;
  leader: string;
  members: PartyMember[];
  /**
   * The private room the leader has open, which the party plays in: members
   * on the Lobby follow it, and one who stepped out can rejoin it.
   */
  room?: { code: string; mode: PartyRoomMode };
}
export type PartyRoomMode = "duel" | "teams" | "ffa" | "raid";
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
  private appearances = new Map<string, PartyAppearance>();
  /** Members whose connection dropped, and when their place lapses. */
  private away = new Map<string, number>();

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
  /** Invitations this party has out (who, and until when). */
  pending(code: string, now: number) {
    const out: { id: string; expiresAt: number }[] = [];
    for (const invite of this.invites.values())
      if (invite.code === code && invite.expiresAt > now)
        out.push({ id: invite.toId, expiresAt: invite.expiresAt });
    return out;
  }
  /** Whether this member's connection dropped (their place is kept). */
  isAway(accountId: string) {
    return this.away.has(accountId);
  }
  /** A member went offline: keep their place until `until`. */
  setAway(accountId: string, until: number) {
    const party = this.of(accountId);
    if (!party) return undefined;
    this.away.set(accountId, until);
    return party;
  }
  /** A member is back online: returns their party when it had them away. */
  back(accountId: string) {
    const party = this.of(accountId);
    if (!party) return undefined;
    const was = this.away.delete(accountId);
    return { party, was };
  }
  /** Members whose kept place has lapsed (still away at `now`). */
  lapsed(now: number) {
    return [...this.away].filter(([, until]) => until <= now).map(([id]) => id);
  }
  /**
   * Put `member` in the party `host` is in (or one `host` leads, created
   * now): the friend who accepted a room invitation plays on with whoever
   * invited them, so going back to the Lobby keeps the team together.
   */
  link(
    host: PartyMember,
    member: PartyMember,
  ): Result<{ party: Party; left?: Party; disbanded?: Party }> | Failure {
    if (host.id === member.id) return { ok: false, error: "Invite a friend." };
    let party = this.of(host.id);
    if (party?.members.some((m) => m.id === member.id))
      return { ok: true, party };
    if (party && party.members.length >= PARTY_SIZE)
      return { ok: false, error: "That party is full." };
    const previous = this.leave(member.id);
    party = this.of(host.id);
    if (!party) {
      party = { code: this.newCode(), leader: host.id, members: [{ ...host }] };
      this.parties.set(party.code, party);
      this.byAccount.set(host.id, party.code);
    }
    party.members.push({ ...member });
    this.byAccount.set(member.id, party.code);
    this.invites.delete(`${party.code}:${member.id}`);
    return {
      ok: true,
      party,
      left: previous?.party,
      disbanded: previous?.disbanded,
    };
  }
  /**
   * The leader removes a member. Returns the party left (or ended, when
   * only the leader remains) for broadcasting.
   */
  kick(
    leaderId: string,
    memberId: string,
  ): Result<{ party: Party; disbanded?: Party }> | Failure {
    const party = this.of(leaderId);
    if (!party || party.leader !== leaderId)
      return { ok: false, error: "Only the party leader can remove players." };
    if (memberId === leaderId || !party.members.some((m) => m.id === memberId))
      return { ok: false, error: "That player isn't in your party." };
    const result = this.leave(memberId)!;
    return { ok: true, ...result };
  }
  /** The leader opened a room (or closed it: `undefined`). */
  setRoom(accountId: string, room: Party["room"]) {
    const party = this.of(accountId);
    if (!party || party.leader !== accountId) return undefined;
    if (party.room?.code === room?.code && party.room?.mode === room?.mode)
      return undefined;
    if (room) party.room = room;
    else delete party.room;
    return party;
  }
  /**
   * Invite `toId` to the sender's party (any member may: most team games
   * let them), creating it with the sender as leader. Callers check friendship, presence and rooms first.
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
    this.appearances.delete(accountId);
    this.away.delete(accountId);
    if (party.leader === accountId && party.members[0]) {
      // The next member online leads; the old leader's room is not theirs.
      party.leader = (
        party.members.find((m) => !this.away.has(m.id)) ?? party.members[0]
      ).id;
      delete party.room;
    }
    if (party.members.length <= 1) {
      for (const m of party.members) {
        this.byAccount.delete(m.id);
        this.appearances.delete(m.id);
        this.away.delete(m.id);
      }
      this.parties.delete(party.code);
      for (const [key, invite] of this.invites)
        if (invite.code === party.code) this.invites.delete(key);
      return { party, disbanded: party };
    }
    return { party };
  }
  /** A member's saved appearance, as loaded from their account. */
  appearanceOf(accountId: string) {
    return this.appearances.get(accountId);
  }
  /**
   * Keep a member's saved appearance while they are in a party. Returns the
   * party to broadcast when it changed what the others see.
   */
  setAppearance(accountId: string, appearance: PartyAppearance) {
    const party = this.of(accountId);
    if (!party) return undefined;
    const before = this.appearances.get(accountId);
    this.appearances.set(accountId, appearance);
    return JSON.stringify(before) === JSON.stringify(appearance)
      ? undefined
      : party;
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
