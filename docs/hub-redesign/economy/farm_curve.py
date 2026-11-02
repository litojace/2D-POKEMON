"""Farm level curve (Lv 1–100) derived from what a regular player actually earns per day at each level."""
import math
from farm_model import daily, plots_at, CROPS, land_lv
T = {1: 0, 5: 0.5, 10: 2.5, 20: 9, 30: 21, 40: 40, 50: 68, 60: 105, 70: 155, 80: 215, 90: 285, 100: 365}
def T_at(L):
    ks = sorted(T)
    for a, b in zip(ks, ks[1:]):
        if a <= L <= b:
            ta, tb = max(T[a], .05), T[b]; return ta * (tb / ta) ** ((L - a) / (b - a))
raw = {L: daily(L, "regular")[0] * (T_at(L + 1) - T_at(L)) for L in range(1, 100)}
# fit a clean formula: xp_next(L) = a * L^b + c  (least squares in log space on L>=3)
import itertools
best = None
for b in [x / 100 for x in range(150, 281, 5)]:
    num = sum(raw[L] * L ** b for L in range(3, 100)); den = sum(L ** (2 * b) for L in range(3, 100)); a = num / den
    err = sum((math.log(max(1, a * L ** b + 40)) - math.log(raw[L])) ** 2 for L in range(3, 100))
    if best is None or err < best[0]: best = (err, a, b)
_, a, b = best
def xp_next(L): return int(round((40 + a * L ** b) / 10) * 10)
def tot(L): return sum(xp_next(l) for l in range(1, L))
print(f"farm curve: xp_next(L) = 40 + {a:.3f} * L^{b:.2f}  -> ", {L: xp_next(L) for L in (1, 5, 10, 20, 30, 50, 70, 99)}, "total100", tot(100))
for arch in ("casual", "regular", "hardcore"):
    days = 0.0; mark = {}; L = 1; xp = 0.0; d = 0
    adays = {"casual": 5, "regular": 6, "hardcore": 7}[arch]
    while L < 100 and d < 3000:
        d += 1
        if (d % 7) < adays: xp += daily(L, arch)[0]
        while L < 100 and xp >= xp_next(L): xp -= xp_next(L); L += 1; mark.setdefault(L, d)
    print(f"{arch:9}", " | ".join(f"lv{k} day {mark.get(k, '-')}" for k in (10, 25, 50, 75, 100)))
open("farm_fit.txt", "w").write(f"{a} {b}")
