import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGlint,
  GLINT_CLASS,
  GLINT_EVERY_MS,
  GLINT_FIRST_MS,
  GLINT_SWEEP_MS,
} from "../../apps/client/src/glint";

// The glint's clock (glint.ts): one sweep about every 5 s for as long as a
// watched button shows, and no timer at all while none does, so a still
// screen, a battle or a hidden page costs nothing.

const button = () => {
  const names = new Set<string>();
  return {
    isConnected: true,
    names,
    classList: {
      add: (name: string) => void names.add(name),
      remove: (name: string) => void names.delete(name),
    },
  };
};
const setup = () => {
  const state = { still: false };
  const glint = createGlint({
    still: () => state.still,
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  return { state, glint };
};

describe("the glint's clock", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("sweeps a watched button about every 5 s, the class on only for a sweep", () => {
    const { glint } = setup();
    const play = button();
    glint.watch(play);
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    vi.advanceTimersByTime(GLINT_FIRST_MS);
    expect(play.names.has(GLINT_CLASS)).toBe(true);
    vi.advanceTimersByTime(GLINT_SWEEP_MS + 100);
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    // Rest until the next one, a period after the first began.
    vi.advanceTimersByTime(GLINT_EVERY_MS - GLINT_SWEEP_MS - 101);
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(play.names.has(GLINT_CLASS)).toBe(true);
    // And on, for as long as it shows.
    vi.advanceTimersByTime(GLINT_EVERY_MS * 10);
    expect(glint.running()).toBe(true);
  });

  it("holds exactly one timer between sweeps, and none once the button is not shown", () => {
    const { glint } = setup();
    const play = button();
    let shown = true;
    glint.watch(play, () => shown);
    vi.advanceTimersByTime(GLINT_FIRST_MS + GLINT_SWEEP_MS + 100);
    expect(vi.getTimerCount()).toBe(1);
    shown = false; // a panel over the Lobby
    vi.advanceTimersByTime(GLINT_EVERY_MS);
    expect(glint.running()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(GLINT_EVERY_MS * 5);
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    // Uncovered: the Lobby wakes it.
    shown = true;
    glint.wake();
    expect(glint.running()).toBe(true);
    vi.advanceTimersByTime(GLINT_FIRST_MS);
    expect(play.names.has(GLINT_CLASS)).toBe(true);
  });

  it("rests while nothing should move (a hidden page, Reduce motion, Low graphics), and waking then does nothing", () => {
    const { glint, state } = setup();
    const play = button();
    state.still = true;
    glint.watch(play);
    expect(glint.running()).toBe(false);
    glint.wake();
    expect(vi.getTimerCount()).toBe(0);
    state.still = false;
    glint.wake();
    vi.advanceTimersByTime(GLINT_FIRST_MS);
    expect(play.names.has(GLINT_CLASS)).toBe(true);
    // Turned on mid-way: the next sweep does not come, and no timer stays.
    state.still = true;
    vi.advanceTimersByTime(GLINT_EVERY_MS * 3);
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waking twice does not double the sweeps", () => {
    const { glint } = setup();
    const play = button();
    glint.watch(play);
    glint.wake();
    glint.wake();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("forgets a button whose screen was rebuilt, and stops when its screen closes", () => {
    const { glint } = setup();
    const old = button();
    glint.watch(old);
    old.isConnected = false; // the title drawn again
    vi.advanceTimersByTime(GLINT_FIRST_MS);
    expect(old.names.has(GLINT_CLASS)).toBe(false);
    expect(glint.running()).toBe(false);

    const play = button();
    const unwatch = glint.watch(play);
    vi.advanceTimersByTime(GLINT_FIRST_MS);
    expect(play.names.has(GLINT_CLASS)).toBe(true);
    unwatch(); // the Lobby closes for a battle
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    expect(glint.running()).toBe(false);
    vi.advanceTimersByTime(GLINT_EVERY_MS * 3);
    expect(play.names.has(GLINT_CLASS)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
