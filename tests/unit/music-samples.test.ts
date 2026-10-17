import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import sources from "../../apps/client/public/assets/music/sources.json";
import {
  MusicSampleBank,
  playSample,
} from "../../apps/client/src/music-samples";

function context() {
  const parameter = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const node = () => ({
    gain: parameter(),
    pan: parameter(),
    playbackRate: parameter(),
    connect: vi.fn(function (target: unknown) {
      return target;
    }),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const source = node();
  const ctx = {
    decodeAudioData: vi.fn(async () => ({ duration: 5 }) as AudioBuffer),
    createBufferSource: () => source,
    createGain: node,
    createStereoPanner: node,
  };
  return { ctx: ctx as unknown as BaseAudioContext, source };
}

it("ships every licensed instrument intact within a small download budget", () => {
  let bytes = 0;
  for (const sample of sources) {
    const data = readFileSync(
      new URL(
        `../../apps/client/public/assets/music/${sample.file}`,
        import.meta.url,
      ),
    );
    bytes += data.length;
    expect(createHash("sha256").update(data).digest("hex")).toBe(sample.sha256);
    expect(sample.license).toBe("CC0-1.0");
    if (sample.rootHz !== null) expect(sample.rootHz).toBeGreaterThan(0);
  }
  expect(bytes).toBeLessThan(1_500_000);
});

it("loads once and chooses the closest recorded pitch with controlled playback", async () => {
  const { ctx, source } = context(),
    bank = new MusicSampleBank(ctx);
  const fetcher = vi.fn(async () => new Response(new ArrayBuffer(4)));
  const loading = bank.load(fetcher);
  expect(bank.load(fetcher)).toBe(loading);
  await loading;
  expect(fetcher).toHaveBeenCalledTimes(sources.length);
  expect(bank.complete).toBe(true);
  expect(bank.get("flute", 1046.502)?.rootHz).toBeCloseTo(1046.502);
  expect(bank.get("cello", 65.406)?.rootHz).toBeCloseTo(65.406);
  expect(bank.get("strings", 293.665)?.rootHz).toBeCloseTo(293.665);
  expect(
    playSample(
      ctx,
      {} as AudioNode,
      bank,
      { instrument: "flute", note: "C6", duration: 0.5, volume: 0.2 },
      1046.502,
      2,
    ),
  ).toBe(true);
  expect(source.playbackRate.value).toBeCloseTo(1);
  expect(source.start).toHaveBeenCalledWith(2);
  expect(source.stop).toHaveBeenCalledWith(2.51);
});

it("keeps available instruments when downloads fail and allows synthesis fallback", async () => {
  const { ctx } = context(),
    bank = new MusicSampleBank(ctx);
  await bank.load(
    vi.fn(async (url) => {
      if (String(url).includes("flute")) throw new Error("Offline");
      return new Response(new ArrayBuffer(4));
    }),
  );
  expect(bank.complete).toBe(true);
  expect(bank.get("piano", 440)).toBeDefined();
  expect(bank.get("flute", 440)).toBeUndefined();
  expect(
    playSample(
      ctx,
      {} as AudioNode,
      bank,
      { instrument: "flute", note: "A4", duration: 1, volume: 0.2 },
      440,
      0,
    ),
  ).toBe(false);
});
