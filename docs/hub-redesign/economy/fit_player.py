from player_model import ARCH, per_active_day
SPARK = 500   # Daily Spark: the first 500 XP each day count double
def avg_day(a, spark=True):
    xp, c = per_active_day(a); return (xp + (min(xp, SPARK) if spark else 0)) * a["days"] / 7
def make(C, p):
    def nxt(L):
        if L < 30: return 100 + 25 * (L - 1)
        if L >= 80: return C
        f = ((L - 29) / 51) ** p
        return int(round((825 + (C - 825) * f) / 50) * 50)
    return nxt
def tot(n, L): return sum(n(l) for l in range(1, L))
reg = avg_day(ARCH["regular"]); best = None
for C in range(5000, 12001, 250):
    for p in [x / 10 for x in range(8, 31)]:
        n = make(C, p); d50, d75, d100 = (tot(n, L) / reg for L in (50, 75, 100))
        err = ((d50 - 100) / 100) ** 2 + ((d75 - 260) / 260) ** 2 + ((d100 - 455) / 455) ** 2 * 2
        if best is None or err < best[0]: best = (err, C, p, d50, d75, d100)
print("best fit", best)
_, C, p, *_ = best; n = make(C, p)
for name, a in ARCH.items():
    av = avg_day(a); print(f"{name:9} avg xp/day {av:6.0f} | lv10 {tot(n,10)/av:5.1f} d | lv25 {tot(n,25)/av:5.0f} d | lv50 {tot(n,50)/av:5.0f} d | lv75 {tot(n,75)/av:5.0f} d | lv100 {tot(n,100)/av:5.0f} d | top level every {C/av:4.1f} d")
print("next-XP:", {L: n(L) for L in (1, 10, 20, 29, 30, 40, 50, 60, 70, 79, 80, 99)}, "total100", tot(n, 100))
import json; json.dump({"C": C, "p": p}, open("player_fit.json", "w"))
