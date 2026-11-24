"""Account (player) progression + coin economy model, using the real game's current numbers
(supabase migrations 010/014/022/025/026/028/031, packages/shared/src/journey.ts + shop.ts)."""
import math

# ---------- real activity rewards today ----------
XP = dict(pvp_win=75, pvp_loss=50, bot=25, raid_clear=200, raid_def=40, mission=50)
COIN = dict(pvp_win=15, pvp_loss=6, raid_clear=60, mission_e=40, mission_m=70, mission_h=120, all6=50, streak7=300)
CAP = dict(pvp_paid=10, raid_paid=5)

# ---------- three kinds of players (per active day) ----------
ARCH = {
    # minutes ≈ PvP 7 min, bot 4 min, raid 5 min
    "casual":   dict(days=4, pvp=2, win=.45, bot=1, raids=1, clear=.7, missions=(1, 1, 1), minutes=25),
    "regular":  dict(days=6, pvp=4, win=.5, bot=2, raids=3, clear=.75, missions=(2, 2, 2), minutes=60),
    "hardcore": dict(days=7, pvp=10, win=.55, bot=4, raids=6, clear=.85, missions=(2, 2, 2), minutes=150),
}

def per_active_day(a, first_win_bonus=0):
    w = a["pvp"] * a["win"]; l = a["pvp"] - w; rc = a["raids"] * a["clear"]; rd = a["raids"] - rc
    m = sum(a["missions"])
    xp = w * XP["pvp_win"] + l * XP["pvp_loss"] + a["bot"] * XP["bot"] + rc * XP["raid_clear"] + rd * XP["raid_def"] + m * XP["mission"]
    xp += first_win_bonus
    pw = min(a["pvp"], CAP["pvp_paid"])
    coins = pw * a["win"] * COIN["pvp_win"] + pw * (1 - a["win"]) * COIN["pvp_loss"] + min(rc, CAP["raid_paid"]) * COIN["raid_clear"]
    e, md, h = a["missions"]; coins += e * COIN["mission_e"] + md * COIN["mission_m"] + h * COIN["mission_h"]
    if m == 6: coins += COIN["all6"] + COIN["streak7"] / 7
    return xp, coins

# ---------- current curve ----------
def cur_next(L): return 100 + 25 * (L - 1)          # XP from L to L+1, cap 50

# ---------- proposed curve to 100 ----------
# Early levels stay exactly as today (players keep their feel and their levels); from Lv 30 the step
# grows faster, and from Lv 80 it stops growing (every late level costs the same, like a season pass),
# so a regular player keeps levelling about once a week at the top instead of grinding for months.
def new_next(L):
    if L < 30: return 100 + 25 * (L - 1)
    step = 100 + 25 * (L - 1) + 3.2 * (min(L, 80) - 29) ** 2
    return int(round(step / 50) * 50)

def total(fn, L): return sum(fn(l) for l in range(1, L))

def days_to(fn, L, xp_day_avg):
    return total(fn, L) / xp_day_avg

if __name__ == "__main__":
    for name, a in ARCH.items():
        xp, c = per_active_day(a); avg = xp * a["days"] / 7; cavg = c * a["days"] / 7
        print(f"{name:9} active-day xp {xp:6.0f} coins {c:5.0f} | avg/day xp {avg:6.0f} coins {cavg:5.0f}"
              f" | CURRENT lv50 in {days_to(cur_next, 50, avg):5.0f} d | NEW lv50 {days_to(new_next, 50, avg):5.0f} d lv75 {days_to(new_next, 75, avg):5.0f} d lv100 {days_to(new_next, 100, avg):5.0f} d")
    print("new curve: next-level XP at", {L: new_next(L) for L in (1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99)})
    print("totals:", {L: total(new_next, L) for L in (10, 25, 30, 50, 75, 100)})
