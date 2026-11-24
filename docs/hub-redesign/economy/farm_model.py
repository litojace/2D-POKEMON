"""Farm economy model (real-time hours). Answers: at farm level L, how much XP and how many
Gold Leaves does each kind of player earn per day, and what does that imply for the XP curve,
crop unlocks, land prices and sinks?  Everything here is a design proposal, not game data."""
import math, json

# ---------------- crops: id, growth hours (unchanged from the demo), rarity ----------------
BASE = [("wheat", 1.0), ("carrot", 1.33), ("voltberry", 1.67), ("mint", 1.87), ("pepper", 2.0), ("lotus", 2.33),
        ("lumen", 2.67), ("duskcap", 3.0), ("plum", 3.33), ("grape", 3.67), ("pumpkin", 4.0), ("kelp", 4.0),
        ("cactus", 4.33), ("yam", 4.67), ("poppy", 5.0), ("halotea", 5.67), ("melon", 6.0), ("pearl", 6.33),
        ("orange", 6.67), ("cotton", 7.33), ("ginseng", 8.0), ("boltcorn", 9.33), ("starfruit", 10.0),
        ("emberlily", 10.67), ("dreamshroom", 12.0)]
# new unlock levels: spread over 1–80 instead of 1–25, so every few levels brings a new crop
UNLOCK = [1, 1, 2, 3, 4, 6, 8, 10, 12, 15, 17, 19, 22, 25, 28, 31, 35, 38, 42, 46, 50, 60, 66, 72, 80]
def rarity(lv): return "common" if lv < 15 else "uncommon" if lv < 35 else "rare" if lv < 60 else "legendary"
XP_M = {"common": 1.0, "uncommon": 1.2, "rare": 1.45, "legendary": 1.8}
PR_M = {"common": 1.0, "uncommon": 1.25, "rare": 1.55, "legendary": 2.0}
CROPS = []
for (cid, h), lv in zip(BASE, UNLOCK):
    r = rarity(lv)
    # XP and profit per harvest grow slower than growth time (h^0.75): short crops pay more per hour,
    # so checking in often is rewarded, while long crops are the convenient choice for busy players.
    xp = max(3, round(3.2 * h ** 0.75 * XP_M[r]))
    profit = max(4, round(3.2 * h ** 0.75 * PR_M[r]))
    cost = max(5, round(profit * 1.2 / 5) * 5)          # seeds cost a bit more than the profit: the seed itself is a sink
    CROPS.append(dict(id=cid, h=h, lv=lv, rar=r, xp=xp, cost=cost, sell=cost + profit))

# ---------------- land: 35 plots to buy, unlocked from Lv 3 to Lv 74 ----------------
def land_lv(k): return round(3 + k * 2.1)

# ---------------- players: when they open the farm (hours of the day) and how many days a week ----------------
ARCH = {
    "casual":   dict(checks=[8, 20], days=5),
    "regular":  dict(checks=[7.5, 12.5, 18, 22.5], days=6),
    "hardcore": dict(checks=[7, 9, 11, 13, 15, 17, 19, 21, 23], days=7),
}
LEG_PER_DAY = 4   # legendary seed stock a player can realistically get per day (shared shop)

def gaps(checks): return [((checks[(i + 1) % len(checks)] - c) % 24) or 24 for i, c in enumerate(checks)]

def harvests_per_day(h, checks, days=14):
    """Plant at a check, harvest at the first check after it is ripe, replant. Average harvests per day."""
    times = [d * 24 + c for d in range(days) for c in sorted(checks)]
    t, n = times[0], 0
    for x in times[1:]:
        if x - t >= h - 1e-9: n += 1; t = x
    return n / (days - 1)

def daily(L, arch, plots=None):
    """XP and leaves per active day at farm level L: every plot runs the crop that pays the most per day
    on this player's check schedule; legendary seeds are limited by shop stock."""
    a = ARCH[arch]; P = plots if plots is not None else plots_at(L)
    avail = [c for c in CROPS if c["lv"] <= L]
    rate = {c["id"]: harvests_per_day(c["h"], a["checks"]) for c in avail}
    per = lambda c: (c["xp"] * rate[c["id"]], (c["sell"] - c["cost"]) * rate[c["id"]])
    normal = max([c for c in avail if c["rar"] != "legendary"], key=lambda c: per(c)[0])
    legs = [c for c in avail if c["rar"] == "legendary"]
    xp, leaves = per(normal)[0] * P, per(normal)[1] * P
    if legs:
        best = max(legs, key=lambda c: per(c)[0])
        if per(best)[0] > per(normal)[0] and rate[best["id"]] > 0:
            nleg = min(P, LEG_PER_DAY / rate[best["id"]])
            xp += (per(best)[0] - per(normal)[0]) * nleg; leaves += (per(best)[1] - per(normal)[1]) * nleg
    xp *= 1.25; leaves *= 1.10                                   # orders
    charm = min(0.25, 0.0025 * L)                                # decorations: up to +25% XP late
    return xp * (1 + charm), leaves, normal["id"]

def plots_at(L): return 15 + sum(1 for k in range(35) if land_lv(k) <= L)

# ---------------- pacing target: cumulative days (regular player) to reach each level ----------------
TARGET = {1: 0, 5: 0.4, 10: 2, 20: 10, 30: 28, 40: 55, 50: 100, 60: 160, 70: 240, 80: 330, 90: 430, 100: 540}
def target_days(L):
    ks = sorted(TARGET)
    for a, b in zip(ks, ks[1:]):
        if a <= L <= b:
            # smooth (log-space) interpolation between anchors
            ta, tb = max(TARGET[a], 0.05), TARGET[b]
            return ta * (tb / ta) ** ((L - a) / (b - a))
    return TARGET[100]

if __name__ == "__main__":
    print(json.dumps(CROPS[:3] + CROPS[-3:], indent=0))
    for L in (1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100):
        r = daily(L, "regular"); c = daily(L, "casual"); h = daily(L, "hardcore")
        print(f"L{L:3} plots {plots_at(L):2} | regular {r[0]:6.0f} xp {r[1]:5.0f} lv ({r[2]}) | casual {c[0]:6.0f} ({c[2]}) | hardcore {h[0]:6.0f} ({h[2]}) | ratio c/r {c[0]/r[0]:.2f} h/r {h[0]/r[0]:.2f}")
