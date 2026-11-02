from fit_player import avg_day, tot
from player_model import ARCH
def make(C, p, flat=80):
    def nxt(L):
        if L < 30: return 100 + 25 * (L - 1)
        if L >= flat: return C
        f = ((L - 29) / (flat - 29)) ** p
        return int(round((825 + (C - 825) * f) / 50) * 50)
    return nxt
reg = avg_day(ARCH["regular"]); rows = []
for flat in (70, 75, 80, 85):
    for C in range(6000, 12001, 250):
        for p in [x / 10 for x in range(10, 31)]:
            n = make(C, p, flat); d = [tot(n, L) / reg for L in (50, 75, 100)]
            jump = n(30) - n(29)
            if jump > 150: continue
            rows.append((abs(d[2] - 455) + 0.3 * abs(d[1] - 230) + 6 * max(0, C / reg - 8), flat, C, p, *[round(x) for x in d], round(C / reg, 1)))
rows.sort()
for r in rows[:6]: print("score %.0f flat %d C %d p %.1f | d50 %d d75 %d d100 %d | top %.1f d/level" % r)
