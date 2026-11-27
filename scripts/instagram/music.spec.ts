/**
 * The skins Reel's sound (docs/instagram.md): the game's own music, the hub
 * theme the Shop plays (docs/music.md), rendered by the game's own synth
 * (pro-synth.ts, music-score.ts) into an OfflineAudioContext, so it is the
 * tune players hear, not a recording of a speaker. Instagram's API can't add
 * its library's music to a Reel, so the Reel carries this.
 *
 *   npx playwright test --config scripts/instagram/playwright.config.ts music.spec.ts
 *
 * Writes instagram-clips/music.wav (48 kHz stereo, 16-bit), which
 * make-reel.py fades, levels and puts under the Reel.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
/** The hub's tune, from its celebratory chorus (bar 24 of 48), as long as the Reel. */
const MUSIC = { theme: "lobby", bar: 24, seconds: 28 };

test("skins reel music", async ({ page }) => {
  await page.goto("/");
  const wav: string = await page.evaluate(
    async ({ root, theme, bar, seconds }) => {
      const src = (f: string) => `/@fs${root}/apps/client/src/${f}`;
      const { ProSynth } = await import(src("pro-synth.ts"));
      const { scoreStep, MUSIC_BPM } = await import(src("music-score.ts"));
      const rate = 48000;
      const ctx = new OfflineAudioContext(2, rate * seconds, rate);
      // The game's music bus (audio.ts): a gain into a -14 dB limiter.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.2;
      limiter.connect(ctx.destination);
      const bus = ctx.createGain();
      bus.connect(limiter);
      const noise = ctx.createBuffer(1, rate, rate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < rate; i++) data[i] = Math.random() * 2 - 1;
      const bpm = MUSIC_BPM[theme];
      const synth = new ProSynth(ctx, bus, noise, bpm);
      // Every sixteenth step from the chosen bar, as audio.ts schedules them.
      let step = bar * 16;
      for (let t = 0.05; t < seconds - 0.1; t += 60 / bpm / 4)
        for (const note of scoreStep(theme, step++, 1)) synth.play(note, t);
      const buffer = await ctx.startRendering();
      // 16-bit PCM WAV.
      const frames = buffer.length,
        channels = buffer.numberOfChannels;
      const out = new DataView(new ArrayBuffer(44 + frames * channels * 2));
      const text = (at: number, s: string) =>
        [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
      text(0, "RIFF");
      out.setUint32(4, 36 + frames * channels * 2, true);
      text(8, "WAVEfmt ");
      out.setUint32(16, 16, true);
      out.setUint16(20, 1, true);
      out.setUint16(22, channels, true);
      out.setUint32(24, rate, true);
      out.setUint32(28, rate * channels * 2, true);
      out.setUint16(32, channels * 2, true);
      out.setUint16(34, 16, true);
      text(36, "data");
      out.setUint32(40, frames * channels * 2, true);
      const lanes = [...Array(channels)].map((_, c) =>
        buffer.getChannelData(c),
      );
      for (let i = 0, at = 44; i < frames; i++)
        for (const lane of lanes) {
          const v = Math.max(-1, Math.min(1, lane[i]));
          out.setInt16(at, v < 0 ? v * 0x8000 : v * 0x7fff, true);
          at += 2;
        }
      let bin = "";
      const bytes = new Uint8Array(out.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { root: ROOT, ...MUSIC },
  );
  const file = path.join(ROOT, "instagram-clips/music.wav");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(wav, "base64"));
  expect(wav.length).toBeGreaterThan(1_000_000);
});
