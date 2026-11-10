"""Write proof/<boss>/*.{png,jpg}: python3 tools/make-proofs.py && it runs tools/shots.cjs."""
import json, pathlib, subprocess, shutil
here = pathlib.Path(__file__).resolve().parent.parent
# boss: (head zoom, head cell, body zoom, body cell, ground, attacks)
B = {
    "gloomshade": (5, [400, 360], 1.7, [470, 330], 0.8, ["lunge", "hands", "snuff", "curse", "split", "pulse"]),
    "somnara": (2.2, [400, 340], 1.05, [480, 330], 0.85, ["lullaby", "tail-splash", "dream-bubbles", "falling-stars", "whale-song", "dream-sequence"]),
    "prismatail": (8, [400, 340], 1.25, [480, 330], 0.9, ["prism-lance", "fan-display", "glare", "refraction", "halo-crush", "light-relay"]),
    "emberwing": (5.2, [400, 360], 1.1, [480, 340], 0.88, ["dive-bomb", "ember-rain", "wing-gust", "flame-ring", "scorched-earth", "heat-mark"]),
    "storm-twins": (2.5, [560, 250], 1.25, [470, 330], 0.9, ["link-beam", "chain-lightning", "static-field", "twin-rush", "polarity", "thunderclap"]),
    "tidewyrm": (3.4, [400, 340], 1.05, [480, 360], 0.85, ["dive", "wave", "bubbles", "hightide", "undertow", "prison"]),
}
jobs = []
shutil.rmtree(here / "proof", ignore_errors=True)
for boss, (hz, hc, bz, bc, ground, attacks) in B.items():
    out = here / "proof" / boss
    out.mkdir(parents=True)
    o = lambda n: str(out / n)
    states = []
    for a in attacks:
        states += [(a + " windup", {"windKind": a, "windup": 1}), (a + " cast", {"castKind": a, "castAge": 0.3})]
    states += [("roar", {"roarAge": 0.55}), ("hurt", {"hurt": 1}), ("stagger", {"stagger": True, "clock": 0.1}), ("exposed", {"exposed": True}), ("defeat", {"dead": True, "deadAge": 2})]
    sway = [("sway left", 6.7), ("centre", 4.49), ("sway right", 2.2)]
    turn = (0, 30, 45, 60, 90, 315)
    jobs += [
        {"boss": boss, "out": o("1-idle-turn.jpg"), "cols": 6, "cell": hc, "zoom": hz, "items": [{"yaw": y, "label": f"{y}° {n}", "cue": {"clock": t}} for n, t in sway for y in turn]},
        {"boss": boss, "out": o("2-construction.jpg"), "cols": 6, "cell": hc, "zoom": hz, "headOnly": True, "lines": True, "items": [{"yaw": y, "cue": {"clock": 4.49}} for y in turn]},
        {"boss": boss, "out": o("3-attacks-heads.jpg"), "cols": 6, "cell": hc, "zoom": hz, "items": [{"yaw": y, "label": f"{n} {y}°", "cue": c} for n, c in states for y in (0, 45, 90)]},
        {"boss": boss, "out": o("4-attacks-body.jpg"), "cols": 4, "cell": bc, "zoom": bz, "body": True, "ground": ground, "items": [{"yaw": 45 if i % 2 == 0 else 90, "label": n, "cue": c} for i, (n, c) in enumerate(states)]},
        {"boss": boss, "out": o("5-turnaround.jpg"), "cols": 4, "cell": bc, "zoom": bz, "body": True, "ground": ground, "items": [{"yaw": y} for y in (0, 45, 90, 135, 180, 225, 270, 315)]},
        {"boss": boss, "out": o("6-phases.jpg"), "cols": 3, "cell": bc, "zoom": bz, "body": True, "ground": ground, "items": [{"yaw": 45, "phase": p, "label": f"phase {p}"} for p in (1, 2, 3)]},
        {"boss": boss, "out": o("7-model-sheet-heads.jpg"), "page": True, "w": 1300, "dsf": 2, "S": {"sheet": True, "close": True, "lines": True}, "clock": 4.49},
        {"boss": boss, "out": o("8-model-sheet-body.jpg"), "page": True, "w": 1300, "dsf": 2, "S": {"sheet": True}, "clock": 4.49},
    ]
jobs.append({"boss": "gloomshade", "out": str(here / "proof" / "demo-phone.jpg"), "page": True, "w": 390, "h": 800, "dsf": 2, "S": {"yaw": 45}})
tmp = here / "build" / "proof-jobs.json"
tmp.parent.mkdir(exist_ok=True)
tmp.write_text(json.dumps(jobs))
subprocess.run(["node", str(here / "tools" / "shots.cjs"), str(tmp)], check=True)
