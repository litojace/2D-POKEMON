import { afterEach, describe, expect, it } from "vitest";
import {
  chosenLobbyMode,
  partyLobbyMode,
  savedLobbyMode,
} from "../../apps/client/src/lobby-screen";

// PLAY's mode: what the player picked last, or for a newcomer a bot match
// (a 1v1 Duel is a private room that would leave them waiting alone).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => store.clear());

describe("PLAY's mode", () => {
  it("starts a new player against an Easy bot", () => {
    expect(chosenLobbyMode()).toBeNull();
    expect(savedLobbyMode()).toBe("bot-easy");
  });
  it("after the coached first bot match, PLAY defaults to Quick Match", () => {
    expect(savedLobbyMode(true)).toBe("quick");
    store.set("arena-lobby-mode", "bot-hard");
    expect(savedLobbyMode(true)).toBe("bot-hard");
  });
  it("a party never gets Quick Match: it gets the room that fits it", () => {
    expect(partyLobbyMode("quick", 1)).toBe("quick");
    expect(partyLobbyMode("quick", 2)).toBe("duel");
  });
  it("keeps the mode a player picked, and ignores an unknown one", () => {
    store.set("arena-lobby-mode", "teams");
    expect(savedLobbyMode()).toBe("teams");
    store.set("arena-lobby-mode", "boss-rush");
    expect(savedLobbyMode()).toBe("bot-easy");
  });
  it("gives a party that never picked a mode the room that fits it", () => {
    expect(partyLobbyMode("bot-easy", 0)).toBe("bot-easy");
    expect(partyLobbyMode("bot-easy", 1)).toBe("bot-easy");
    expect(partyLobbyMode("bot-easy", 2)).toBe("duel");
    expect(partyLobbyMode("bot-easy", 3)).toBe("ffa");
    expect(partyLobbyMode("bot-easy", 4)).toBe("teams");
    expect(partyLobbyMode("raid", 3)).toBe("raid");
  });
  it("leaves a party's own pick alone (the usual message explains it)", () => {
    store.set("arena-lobby-mode", "bot-hard");
    expect(partyLobbyMode("bot-hard", 2)).toBe("bot-hard");
  });
});
