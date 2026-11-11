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

/**
 * How smoothly a match ran on a player's device, sent once at its end as
 * "battle-perf" and logged by the server as "arena-perf"
 * (apps/client/src/battle-perf.ts). Technical numbers only: no name or
 * account.
 */
export const battlePerfSchema = z
  .object({
    /** Seconds of live play measured. */
    seconds: z.number().min(0).max(36_000),
    frames: z.number().int().min(0).max(10_000_000),
    /** Frames per second at the median frame. */
    fps: z.number().min(0).max(1000),
    /** 95th percentile frame time, ms. */
    frameP95: z.number().min(0).max(10_000),
    /** Share of the time in frames that missed 30 fps. */
    jank: z.number().min(0).max(1),
    /** Frames slower than 250 ms. */
    stalls: z.number().int().min(0).max(10_000_000),
    /** The battle graphics level drawn at the end. */
    quality: z.enum(["high", "medium", "low"]),
    /** Settings → Graphics. */
    setting: z.enum(["auto", "high", "low"]),
    /** Canvas pixels per CSS pixel. */
    density: z.number().min(0.25).max(8),
    memory: z.number().min(0).max(1024).optional(),
    cores: z.number().int().min(1).max(1024).optional(),
    /** The network side (NetMeter): optional, older clients omit it. */
    rttP50: z.number().min(0).max(60_000).optional(),
    rttP95: z.number().min(0).max(60_000).optional(),
    snapGapP95: z.number().min(0).max(60_000).optional(),
    snapLate: z.number().min(0).max(1).optional(),
    corrections: z.number().min(0).max(100_000).optional(),
    correctionMax: z.number().min(0).max(100_000).optional(),
    confirmP50: z.number().min(0).max(60_000).optional(),
    /** Round trip to the server at the end (ms, smoothed; the ping badge). */
    ping: z.number().min(0).max(60_000).optional(),
    /**
     * How far ahead of the last snapshot your fighter was drawn, on average
     * (ms): unanswered inputs plus the snapshot's age (timeline-lead.ts).
     */
    lead: z.number().min(0).max(60_000).optional(),
    /** Corrections a minute by cause (correction-cause.ts); "other" is a prediction fault. */
    correctionsHit: z.number().min(0).max(100_000).optional(),
    correctionsStatus: z.number().min(0).max(100_000).optional(),
    correctionsMove: z.number().min(0).max(100_000).optional(),
    correctionsOther: z.number().min(0).max(100_000).optional(),
    /** Hits on you that landed over 24 px from where you were drawn, and the largest gap (px). */
    hitsFar: z.number().int().min(0).max(1_000_000).optional(),
    hitGapMax: z.number().min(0).max(100_000).optional(),
    /** Script errors during the match. */
    errors: z.number().int().min(0).max(1_000_000).optional(),
    /** The build the device ran (a commit, or "dev"). */
    build: z
      .string()
      .regex(/^[a-z0-9-]{1,16}$/)
      .optional(),
    /** The system family, coarsely, and whether it ran as the installed app. */
    os: z.enum(["ios", "android", "mac", "windows", "linux", "other"]).optional(),
    app: z.boolean().optional(),
    /** The browser drew without the graphics card (client gpu-check.ts). */
    gpu: z.literal("software").optional(),
  })
  .strict();
export type BattlePerf = z.infer<typeof battlePerfSchema>;
