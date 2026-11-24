"""Chosen account-level curve (Lv 1–100). Levels 1–50 are exactly today's curve, so nobody loses a level;
51–100 is new: a climb to 9,000 XP per level by Lv 70, then a slow rise (about one level a week)."""
import contextlib, io
with contextlib.redirect_stdout(io.StringIO()):
    from fit_player import avg_day
from player_model import ARCH
def xp_next(L):
    if L < 50: return 100 + 25 * (L - 1)                                                   # unchanged
    if L < 70: return int(round((1300 + 7700 * ((L - 49) / 21) ** 1.3) / 50) * 50)        # 1,300 → 9,000
    return 9000 + 75 * (L - 69)                                                             # 9,075 → 11,250
def total(L): return sum(xp_next(l) for l in range(1, L))
if __name__ == "__main__":
    print({L: xp_next(L) for L in (1, 10, 20, 30, 40, 49, 50, 55, 60, 65, 69, 70, 80, 90, 99)}, "TOTAL to 100:", total(100))
    for name, a in ARCH.items():
        av = avg_day(a)
        cells = " | ".join(f"lv{L} {total(L) / av:5.0f} d" for L in (10, 25, 50, 60, 75, 90, 100))
        print(f"{name:9} {av:5.0f} xp/day | {cells} | top every {xp_next(99) / av:4.1f} d")
