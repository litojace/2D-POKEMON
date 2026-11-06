import { z } from "zod";

/**
 * What a player's browser saw when its game connection dropped. Sent once
 * after it reconnects (the "connection-report" event) so the server log
 * holds both sides of a drop: the server only sees that the socket closed
 * or went quiet, not whether the page was in the background or offline.
 */
export const connectionReportSchema = z
  .object({
    /** Socket.IO's client-side disconnect reason, e.g. "ping timeout". */
    reason: z.string().min(1).max(40),
    /** The transport in use when it dropped: "websocket" or "polling". */
    transport: z.string().min(1).max(20),
    /** The page was hidden at, or shortly before, the drop. */
    hidden: z.boolean(),
    /** The browser reported being offline at, or shortly before, the drop. */
    offline: z.boolean(),
    /** Whole seconds between the drop and this reconnect. */
    away: z.number().int().min(0).max(86_400),
  })
  .strict();
export type ConnectionReport = z.infer<typeof connectionReportSchema>;

/**
 * How long a player's device took to load the battle (renderer start until
 * every fighter's art was ready), sent once per battle renderer as
 * "battle-loaded" and logged by the server as "arena-load".
 */
export const battleLoadSchema = z
  .object({
    ms: z.number().int().min(0).max(600_000),
    /** Fighters loaded for that battle. */
    fighters: z.number().int().min(0).max(32),
    /** navigator.deviceMemory (GB, rounded by the browser), where offered. */
    memory: z.number().min(0).max(1024).optional(),
    /** navigator.hardwareConcurrency, where offered. */
    cores: z.number().int().min(1).max(1024).optional(),
  })
  .strict();
export type BattleLoad = z.infer<typeof battleLoadSchema>;
