import json, contextlib, io
with contextlib.redirect_stdout(io.StringIO()):
    import player_curve as PC, farm_curve as FC
    from fit_player import avg_day
from player_model import ARCH as PA, per_active_day
from farm_model import daily, ARCH as FA
D = json.load(open('data.json'))
cur_p = [100 + 25 * (L - 1) for L in range(1, 50)]
new_p = [PC.xp_next(L) for L in range(1, 100)]
def days_curve(nexts, perday):
    out, t = [0.0], 0.0
    for x in nexts: t += x / perday; out.append(round(t, 1))
    return out
pdays = {a: days_curve(new_p, avg_day(PA[a])) for a in PA}
pdays_cur = {a: days_curve(cur_p, avg_day(PA[a], False)) for a in PA}
cur_f = [60 + 6 * L * L for L in range(1, 100)]
new_f = [FC.xp_next(L) for L in range(1, 100)]
fdays = {}
for a in FA:
    adays = FA[a]["days"]; L, xp, d, marks = 1, 0.0, 0, [0]
    while L < 100 and d < 3000:
        d += 1
        if (d % 7) < adays: xp += daily(L, a)[0]
        while L < 100 and xp >= FC.xp_next(L): xp -= FC.xp_next(L); L += 1; marks.append(d)
    fdays[a] = marks
# coins per day by source (average day incl. rest days), proposed extras: level coins, season coins, leaves trade
coins = {}
for a in PA:
    src = dict(D['player']['coins'][a])
    days100 = pdays[a][-1]; src['levels'] = round((49 * 30 + 50 * 100) / days100)
    season_tiers = min(30, D['player']['season'][a]['tier_by_day30']); src['season'] = round(season_tiers * 50 / 30)
    src['farm'] = round(D['farm']['run'][{'casual': 'casual', 'regular': 'regular', 'hardcore': 'hardcore'}[a]]['coins_from_trade'] / 450) if a else 0
    coins[a] = src
# season: current 20x400 vs proposed 30x1200
season = {}
for a in PA:
    weekly_n = {"casual": 2, "regular": 4, "hardcore": 4}[a]
    cur_per = avg_day(PA[a], False) + weekly_n * 250 / 7; new_per = avg_day(PA[a]) + weekly_n * 250 / 7
    season[a] = dict(cur_day=round(8000 / cur_per, 1), new_day=round(36000 / new_per, 1), new_tier30=round(min(30, 30 * new_per / 1200), 1))
leaves = {L: dict(income=round(daily(L, 'regular')[1]), dog=max([g['day'] for g in D['farm']['dogs'] if g['lv'] <= L] or [0]), trade=800) for L in range(1, 101, 3)}
wallet = {a: [(x['day'], x['L'], x['wallet']) for x in D['farm']['run'][a]['log'] if x['day'] % 30 == 0] for a in FA}
out = dict(cur_p=cur_p, new_p=new_p, pdays=pdays, pdays_cur=pdays_cur, cur_f=cur_f, new_f=new_f, fdays=fdays, coins=coins, season=season,
           xpday=D['player']['xpday'], xpday_nospark=D['player']['xpday_nospark'], crops=D['farm']['crops'], land=D['farm']['land'], wallet=wallet,
           leaves=leaves, farm_xpday=D['farm']['xpday'], farm_spent={a: D['farm']['run'][a]['spent'] for a in FA})
json.dump(out, open('report_data.json', 'w'))
print('coins/day', coins); print('season', season); print('farm 100 days', {a: fdays[a][-1] for a in fdays}); print('player 100 days', {a: pdays[a][-1] for a in pdays}, 'current 50', {a: pdays_cur[a][-1] for a in pdays_cur})
print('size', len(json.dumps(out)))
