/*
 * Gold Leaves (migration 036): the wallet the Bistro pays into and the coin
 * exchange spends from (docs/currency-exchange.md).
 */
/** 100 Gold Leaves trade for 5 coins, up to 60 coins a Pacific day. */
export const LEAF_TRADE = { leaves: 100, coins: 5, dailyCoins: 60 } as const;
