import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgetPrepainted,
  keepPrepainted,
  prepaintedKeys,
  takePrepainted,
} from "../../apps/client/src/boss-prepaint";

afterEach(() => forgetPrepainted());

describe("boss atlases painted ahead", () => {
  it("paints once ahead, and the battle takes that one instead of painting again", () => {
    const paint = vi.fn(() => ({ canvas: "atlas" }));
    keepPrepainted("emberwing", paint);
    keepPrepainted("emberwing", paint);
    expect(paint).toHaveBeenCalledTimes(1);
    const taken = takePrepainted("emberwing", paint);
    expect(taken).toEqual({ canvas: "atlas" });
    expect(paint).toHaveBeenCalledTimes(1);
  });
  it("is taken once: the next battle paints its own (nothing stays in memory)", () => {
    const paint = vi.fn(() => ({}));
    keepPrepainted("tidewyrm:1", paint);
    takePrepainted("tidewyrm:1", paint);
    expect(prepaintedKeys()).toEqual([]);
    takePrepainted("tidewyrm:1", paint);
    expect(paint).toHaveBeenCalledTimes(2);
  });
  it("keeps only the room's boss, and forgets everything on leaving raids", () => {
    keepPrepainted("emberwing", () => 1);
    keepPrepainted("tidewyrm:1", () => 2);
    keepPrepainted("tidewyrm:2", () => 3);
    forgetPrepainted("tidewyrm");
    expect(prepaintedKeys().sort()).toEqual(["tidewyrm:1", "tidewyrm:2"]);
    forgetPrepainted();
    expect(prepaintedKeys()).toEqual([]);
  });
});
