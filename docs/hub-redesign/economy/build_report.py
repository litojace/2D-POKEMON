"""Fills report.tpl.html with report_data.json -> kinh-te.html (the published economy report).
Crop ids are shown with their in-game names, read from the prototype's CROPS table."""
import json, re
src = open("../prototype/app/farm.js").read(); block = src[src.index("const CROPS = ["):src.index("].map(", src.index("const CROPS = ["))]
names = dict(re.findall(r'^\s*\["(\w+)", "([^"]+)"', block, re.M))
assert len(names) == 25, len(names)
d = json.load(open("report_data.json"))
for c in d["crops"]: c["id"] = names.get(c["id"], c["id"])
data = json.dumps(d, separators=(",", ":"), ensure_ascii=False)
assert "</script" not in data
open("kinh-te.html", "w").write(open("report.tpl.html").read().replace("__DATA__", data))
