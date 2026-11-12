import {
  raidSoloRevive,
  type RaidBossId,
} from "../../../packages/shared/src/raid";

/**
 * Solo raiders get one self-revive, except against ★★★ bosses: there one
 * knockout ends the run (the boss tier table, `raidSoloRevive`, which the
 * server uses too). Every screen that offers or starts a solo raid says so
 * before the fight.
 */
export const soloRevives = (boss: RaidBossId) => !!raidSoloRevive(boss);
export const SOLO_NO_REVIVE =
  "No revive solo at ★★★ · one knockout ends the run";
