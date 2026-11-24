/**
 * Reproduce the battle input accumulator with Phaser's real frame clock.
 * Run at the repository root: node scripts/perf/input-clock-probe.cjs
 * Pure clock probe; no phone FPS, rendering or network is simulated.
 */
const TimeStep = require(
  process.cwd() + "/node_modules/phaser/src/core/TimeStep.js",
);

function measure(name, frameMs) {
  const loop = new TimeStep({}, {});
  loop.deltaHistory = Array(loop.deltaSmoothingMax).fill(1000 / 60);
  loop.lastTime = 0;
  let now = 0,
    accumulator = 0,
    sent = 0,
    rawTotal = 0,
    gameTotal = 0;
  let previousInputAt = 0,
    maxSendGap = 0,
    sameFrame = 0;
  loop.callback = (time, delta) => {
    rawTotal += loop.rawDelta;
    gameTotal += delta;
    accumulator += Math.min(delta, 100);
    let burst = 0;
    while (accumulator >= 1000 / 30) {
      accumulator -= 1000 / 30;
      sent++;
      burst++;
      if (previousInputAt)
        maxSendGap = Math.max(maxSendGap, time - previousInputAt);
      previousInputAt = time;
    }
    sameFrame = Math.max(sameFrame, burst);
  };
  for (const gap of frameMs) loop.step((now += gap));
  return {
    name,
    realSeconds: +(rawTotal / 1000).toFixed(2),
    gameSeconds: +(gameTotal / 1000).toFixed(2),
    inputHz: +(sent / (now / 1000)).toFixed(2),
    maxSendGapMs: +maxSendGap.toFixed(1),
    maxInputsInOneFrame: sameFrame,
  };
}
const regular = Array(60 * 60).fill(1000 / 60);
const periodic = regular.map((gap, i) => (i % 120 === 119 ? 150 : gap));
const periodic250 = regular.map((gap, i) => (i % 120 === 119 ? 250 : gap));
const slow = Array(60 * 5).fill(200);
console.log(
  JSON.stringify(
    [
      measure("60 fps, steady", regular),
      measure("150 ms hitch every 120 frames", periodic),
      measure("250 ms hitch every 120 frames", periodic250),
      measure("200 ms per frame", slow),
    ],
    null,
    2,
  ),
);
