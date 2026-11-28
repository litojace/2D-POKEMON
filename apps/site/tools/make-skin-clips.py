#!/usr/bin/env python3
"""The website's skin loops, from the fitting room recorded frame by frame
by scripts/site-clips/skins.spec.ts (docs/website.md, "Skins with their
effects").

    python3 apps/site/tools/make-skin-clips.py [name ...]   # from the repo root

For each recording (site-clips/skins/<name>/):

- the loop: one showcase cycle (4.4 s of the stage's clock) for a skin, or
  the stretch of the idle that comes back closest to its first frame for a
  Classic look. The frames recorded past the loop are blended into its first
  frames, so it wraps without a jump.
- media/skins/<name>.mp4: H.264, which every browser and phone plays,
  720 x 720 at 60 frames a second, no sound. (VP9 and AV1 came out larger
  than H.264 tuned for animation on these stages, so there is one file.)
- img/skins/<name>.webp: the poster (shown until the loop plays, in Low
  Power Mode, and when motion is paused), and <name>-thumb.webp for the
  skin strip, cut closer round the fighter.

Needs Pillow 11+, NumPy and ffmpeg with libx264.
"""
from pathlib import Path
import json
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
FRAMES = ROOT / "site-clips/skins"
SITE = ROOT / "apps/site"
SIZE = 720
THUMB = 192
FPS = 60
# Where the poster is taken from, in seconds into the loop: a skin's effect
# in full (the victory's sign, the ultimate after its flash), the Classic
# look at rest.
POSTER_AT = {"victory": 1.0, "ultimate": 0.9, "idle": 0.0}


def load(src: Path, i: int, size: int) -> np.ndarray:
    im = Image.open(src / f"{i:03d}.jpg").convert("RGB")
    return np.asarray(im.resize((size, size), Image.LANCZOS), dtype=np.float32)


def idle_loop(src: Path, count: int, tail: int, step_ms: int) -> int:
    """The loop length (in frames) whose wrap differs least from its start."""
    small = [load(src, i, 96) for i in range(count)]
    head = np.stack(small[:tail])
    lo = round(2500 / step_ms)
    diffs = {
        n: float(np.abs(np.stack(small[n : n + tail]) - head).mean())
        for n in range(lo, count - tail + 1)
    }
    best = min(diffs.values())
    # Where the idle comes back round: the stretches closer than their
    # neighbours. The shortest of those nearly as close as the best is one
    # breath, not two (half the file, the same look once blended).
    turns = [
        n
        for n, d in diffs.items()
        if d <= diffs.get(n - 1, d) and d <= diffs.get(n + 1, d)
    ]
    return min(n for n in turns if diffs[n] <= best * 1.2 + 0.15)


def encode(frames, out: Path):
    raw = ["-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{SIZE}x{SIZE}", "-r", str(FPS), "-i", "-"]
    # Fast start: it plays as it loads. "animation" keeps flat colour and
    # outlines clean at a lower rate.
    args = [*raw, "-c:v", "libx264", "-preset", "slower", "-crf", "28", "-tune", "animation",
            "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(out)]
    data = b"".join(np.clip(f, 0, 255).astype(np.uint8).tobytes() for f in frames)
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], input=data, check=True)


def make(name: str):
    src = FRAMES / name
    meta = json.loads((src / "meta.json").read_text())
    tail, step = meta["tail"], meta["stepMs"]
    count = len(meta["clocks"])
    steps = {b - a for a, b in zip(meta["clocks"], meta["clocks"][1:])}
    if steps != {step}:
        print(f"  {name}: uneven steps {sorted(steps)} (expected {step} ms)")
    if meta["action"] == "idle":
        length = idle_loop(src, count, tail, step)
    else:
        length = round(meta["cycleMs"] / step)
    length = min(length, count - tail)
    frames = [load(src, i, SIZE) for i in range(length + tail)]
    loop = frames[:length]
    for i in range(tail):
        a = (i + 1) / (tail + 1)
        loop[i] = frames[length + i] * (1 - a) + frames[i] * a
    mp4 = SITE / "media/skins" / f"{name}.mp4"
    mp4.parent.mkdir(parents=True, exist_ok=True)
    encode(loop, mp4)
    img = SITE / "img/skins"
    img.mkdir(parents=True, exist_ok=True)
    at = min(length - 1, round(POSTER_AT[meta["action"]] * FPS))
    still = Image.fromarray(np.clip(loop[at], 0, 255).astype(np.uint8))
    still.save(img / f"{name}.webp", "WEBP", quality=80, method=6)
    # The strip's thumbnail: the fighter itself, cut closer.
    m = round(SIZE * 0.17)
    still.crop((m, round(m * 0.9), SIZE - m, SIZE - round(m * 1.1))).resize(
        (THUMB, THUMB), Image.LANCZOS
    ).save(img / f"{name}-thumb.webp", "WEBP", quality=78, method=6)
    kb = lambda p: p.stat().st_size // 1024
    print(f"{name}: {length} frames ({length / FPS:.2f} s), {kb(mp4)} KB")
    return mp4.stat().st_size


def main():
    if not FRAMES.is_dir():
        sys.exit(f"{FRAMES} missing: run scripts/site-clips/skins.spec.ts first")
    names = sys.argv[1:] or sorted(p.name for p in FRAMES.iterdir() if (p / "meta.json").exists())
    total = sum(make(n) for n in names)
    print(f"{len(names)} loops, {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
