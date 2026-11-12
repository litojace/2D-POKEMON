import {
  RAID_BOSSES,
  type RaidBossId,
} from "../../../packages/shared/src/raid";

/**
 * Solo raiders get one self-revive, except against ★★★ bosses: there one
 * knockout ends the run. Every screen that offers or starts a solo raid says
 * so before the fight.
 */
export const soloRevives = (boss: RaidBossId) => RAID_BOSSES[boss].stars < 3;
export const SOLO_NO_REVIVE =
  "No revive solo at ★★★ · one knockout ends the run";
