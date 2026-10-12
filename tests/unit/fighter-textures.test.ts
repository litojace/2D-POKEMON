import { expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  fighterArt,
  fighterTextureData,
} from "../../apps/client/src/fighter-art";
it("encodes every fighter as base64 SVG for the Phaser loader", () => {
  for (const id of Object.keys(CHARACTERS) as CharacterId[]) {
    const url = fighterTextureData(id);
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(url.split(",")[1]), (char) => char.charCodeAt(0)),
    );
    expect(decoded).toBe(fighterArt(id));
    expect(decoded).toContain("<svg");
  }
});
