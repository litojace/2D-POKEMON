"""Re-render one boss's proofs: python3 tools/proofs-one.py tidewyrm"""
import json, pathlib, subprocess, sys
from PIL import Image
here = pathlib.Path(__file__).resolve().parent.parent
boss = sys.argv[1]
src = (here / "tools/make-proofs.py").read_text()
L = []
exec(
    src.replace("subprocess.run(", "ns_jobs.append(jobs) or (lambda *a, **k: None)(")
    .replace('shutil.rmtree(here / "proof", ignore_errors=True)', "pass")
    .replace("out.mkdir(parents=True)", "out.mkdir(parents=True, exist_ok=True)"),
    {"__file__": str(here / "tools/make-proofs.py"), "ns_jobs": L},
)
jobs = [j for j in L[0] if j["boss"] == boss and "demo-phone" not in j["out"]]
for j in jobs:
    j["out"] = j["out"].replace(".jpg", ".png")
(here / "build").mkdir(exist_ok=True)
(here / "build/one-jobs.json").write_text(json.dumps(jobs))
subprocess.run(["node", str(here / "tools/shots.cjs"), str(here / "build/one-jobs.json")], check=True)
for f in (here / "proof" / boss).glob("*.png"):
    im = Image.open(f).convert("RGB")
    if f.name.startswith(("3-", "4-")):
        im = im.resize((int(im.width * 0.75), int(im.height * 0.75)), Image.LANCZOS)
    im.save(f.with_suffix(".jpg"), quality=78, optimize=True)
    f.unlink()
print("rendered", boss)
