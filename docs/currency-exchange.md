# Currency exchange allowances

Both conversion rates stay unchanged. Limits are per player and Pacific day.

| Exchange                       | Rate     | Daily allowance               |
| ------------------------------ | -------- | ----------------------------- |
| Gold Leaves → Arena shop coins | 100 → 5  | 60 shop coins (previously 40) |
| Bistro coins → Gold Leaves     | 100 → 20 | 600 Leaves (previously 300)   |

Bistro trades can therefore contribute up to 30 shop coins per day through
Leaves. Those 30 count toward the same 60-coin allowance as Leaves earned
on the Farm; they are not an additional allowance.

The server and database accept up to 12 lots for Leaves → coins and 30 lots
for Bistro → Leaves. Bistro's Bank offers 20, 100 and 600 Leaves. Farm and
shop displays read the new limits from the shared rules/database response.

[The migration](../supabase/migrations/20261116150001_raise_currency_trade_caps.sql)
replaces the three relevant functions without rewriting wallets, trade
ledgers or request receipts. Trades already made today still count; a
player who exchanged 40 shop coins can exchange another 20 that day.
Reapplying the migration preserves balances and counters. Requests retain
the existing player locks, authenticated ownership checks and Bistro
request-id replay protection.

It ships with the code and runs through the automatic production migration
pipeline described in [auto-migrations.md](auto-migrations.md).

Validation includes a mid-day upgrade from the old caps, repeated migration
application, unchanged conversion rates, full-day batches, over-limit and
malformed requests, shared allowance, next-day allowance, and RPC permissions.
