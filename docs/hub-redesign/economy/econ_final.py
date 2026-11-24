"""All final numbers in one place -> data.json (used by the demo and the report)."""
import json, math, contextlib, io
with contextlib.redirect_stdout(io.StringIO()):
    import farm_curve as FC
    import player_curve as PC
    from fit_player import avg_day
from farm_model import daily, plots_at, CROPS, land_lv, ARCH as FARCH
from player_model import ARCH as PARCH, per_active_day
r50 = lambda x: int(round(x / 50) * 50)

# ---------------- farm: leaves ----------------
inc = {L: daily(L, "regular")[1] for L in range(1, 101)}
LAND = [dict(k=k, lv=land_lv(k), price=max(150, r50(1.0 * inc[land_lv(k)]))) for k in range(35)]
DOGS = [dict(id="gold", lv=3, day=60), dict(id="black", lv=20, day=180), dict(id="cream", lv=40, day=300)]
TOOLS = [("scarecrow", 4, 300), ("can2", 8, 600), ("bignet", 10, 700), ("sickle", 14, 1200), ("sprinkler1", 18, 1500), ("fertgold", 24, 0),
         ("sprinkler2", 26, 2200), ("can3", 30, 4000), ("sprinkler3", 34, 3000), ("sprinkler4", 42, 3800), ("sprinkler5", 50, 4500), ("can4", 55, 12000)]
# decorations: 40 pieces from Lv 1 to 100, each worth 1–4 days of income at its level; three trophies at 75/90/100
DECOR = []
for i in range(37):
    L = 1 + round(i * 2.45); DECOR.append(dict(lv=L, cost=r50(inc[L] * (1 + 3 * i / 36)), charm=1 + i // 4))
DECOR += [dict(lv=75, cost=30000, charm=12, trophy=1), dict(lv=90, cost=45000, charm=14, trophy=1), dict(lv=100, cost=60000, charm=16, trophy=1)]
EXCH = dict(leaves=100, coins=5, cap_coins=40)

def farm_run(arch):
    """day-by-day: level, leaves after buying land/tools/decor when unlocked, renting the best dog, using fertilizer,
    and trading leaves for coins up to the daily cap once the wallet holds a 3-day cushion."""
    adays = FARCH[arch]["days"]; L, xp, wallet, d = 1, 0.0, 300.0, 0
    land_i = tool_i = 0; owned_decor = set(); trades = 0; spent = dict(land=0, tools=0, decor=0, dog=0, fert=0, trade=0); log = []
    tools = sorted(TOOLS, key=lambda t: t[1])
    while d < 900:
        d += 1; active = (d % 7) < adays
        if active:
            x, lv_inc, _ = daily(L, arch, plots=15 + land_i); xp += x; wallet += lv_inc
            dog = max([g for g in DOGS if g["lv"] <= L], key=lambda g: g["lv"], default=None)
            if dog and wallet > dog["day"] * 2: wallet -= dog["day"]; spent["dog"] += dog["day"]
            f = 0.06 * lv_inc; wallet -= f; spent["fert"] += f
        while L < 100 and xp >= FC.xp_next(L):
            xp -= FC.xp_next(L); L += 1; wallet += 40 + 10 * L                     # level-up leaves
        while land_i < 35 and LAND[land_i]["lv"] <= L and wallet >= LAND[land_i]["price"]:
            wallet -= LAND[land_i]["price"]; spent["land"] += LAND[land_i]["price"]; land_i += 1
        while tool_i < len(tools) and tools[tool_i][1] <= L and wallet >= tools[tool_i][2]:
            wallet -= tools[tool_i][2]; spent["tools"] += tools[tool_i][2]; tool_i += 1
        for i, dc in enumerate(DECOR):
            if i not in owned_decor and dc["lv"] <= L and wallet >= dc["cost"] + 3 * inc[L]:
                wallet -= dc["cost"]; spent["decor"] += dc["cost"]; owned_decor.add(i)
        if active and wallet > 3 * inc[L]:
            t = min(EXCH["cap_coins"] * 20, wallet - 3 * inc[L]); wallet -= t; spent["trade"] += t; trades += t / 20
        if d % 30 == 0 or L == 100: log.append(dict(day=d, L=L, wallet=round(wallet), plots=15 + land_i, decor=len(owned_decor)))
        if L == 100 and d % 30 == 0: break
    return dict(log=log, spent={k: round(v) for k, v in spent.items()}, coins_from_trade=round(trades))

# ---------------- player: coins ----------------
def coin_sources(arch):
    a = PARCH[arch]; w = a["pvp"] * a["win"]; l = a["pvp"] - w; rc = a["raids"] * a["clear"]; e, m, h = a["missions"]
    k = a["days"] / 7
    src = dict(pvp=(min(a["pvp"], 10) * (a["win"] * 15 + (1 - a["win"]) * 6)) * k, raids=min(rc, 5) * 60 * k,
               missions=(e * 40 + m * 70 + h * 120) * k, bonus=((50 + 300 / 7) if e + m + h == 6 else 0) * k)
    return src

SEASON = dict(tiers=30, tier_xp=1200, coins_per_tier=50, items_at=[5, 12, 20, 30], weekly_goal_xp=250)
def season_day(arch):
    av = avg_day(PARCH[arch]); weekly = {"casual": 2, "regular": 4, "hardcore": 4}[arch] * 250 / 7
    need = SEASON["tiers"] * SEASON["tier_xp"]; per = av + weekly
    return need / per, min(SEASON["tiers"], 30 * per / SEASON["tier_xp"])

out = dict(
    player=dict(xp_next=[PC.xp_next(L) for L in range(1, 100)], total100=PC.total(100),
                pace={a: {L: round(PC.total(L) / avg_day(PARCH[a]), 1) for L in (10, 25, 50, 60, 75, 90, 100)} for a in PARCH},
                xpday={a: round(avg_day(PARCH[a])) for a in PARCH}, xpday_nospark={a: round(avg_day(PARCH[a], False)) for a in PARCH},
                coins={a: {k: round(v) for k, v in coin_sources(a).items()} for a in PARCH},
                season={a: dict(zip(("finish_day", "tier_by_day30"), [round(x, 1) for x in season_day(a)])) for a in PARCH}),
    farm=dict(xp_next=[FC.xp_next(L) for L in range(1, 100)], total100=FC.tot(100),
              xpday={a: {L: round(daily(L, a)[0]) for L in (1, 10, 25, 50, 75, 100)} for a in FARCH},
              leaves_day={L: round(inc[L]) for L in (1, 10, 25, 50, 75, 100)},
              crops=CROPS, land=LAND, dogs=DOGS, tools=TOOLS, decor=DECOR, exch=EXCH,
              run={a: farm_run(a) for a in FARCH}),
    season=SEASON)
json.dump(out, open("data.json", "w"))
print("player pace", json.dumps(out["player"]["pace"])); print("coins/day", json.dumps(out["player"]["coins"])); print("season", json.dumps(out["player"]["season"]))
print("leaves/day regular", out["farm"]["leaves_day"]); print("land prices", [x["price"] for x in LAND][:6], "...", [x["price"] for x in LAND][-4:], "sum", sum(x["price"] for x in LAND))
for a in FARCH:
    r = out["farm"]["run"][a]; print(a, "spent", r["spent"], "coins from trade", r["coins_from_trade"]); print("   ", r["log"][:3], "...", r["log"][-2:])
