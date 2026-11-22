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
    /**
     * Where the time went (ms), in order: starting the renderer (the WebGL
     * context and Phaser, up to the scene's preload), loading the fighters'
     * art (preload to create), and building the scene (create to the first
     * frame with every fighter ready: atlases, effect sprites, the court).
     */
    boot: z.number().int().min(0).max(600_000).optional(),
    assets: z.number().int().min(0).max(600_000).optional(),
    scene: z.number().int().min(0).max(600_000).optional(),
    /** Canvas pixels per CSS pixel the battle drew at. */
    density: z.number().min(0.1).max(8).optional(),
    /** As in battle-perf: the build, the system family, the installed app. */
    build: z
      .string()
      .regex(/^[a-z0-9-]{1,16}$/)
      .optional(),
    os: z
      .enum(["ios", "android", "mac", "windows", "linux", "other"])
      .optional(),
    app: z.boolean().optional(),
  })
  .strict();
export type BattleLoad = z.infer<typeof battleLoadSchema>;

/**
 * A fighter's art found blank in battle and loaded again (rig-health.ts in
 * the client), sent as "battle-art" and logged by the server as
 * "arena-art-blank": which fighter, how many of its textures, and the moment
 * that found it. A player's own fighter vanished on an iPhone (22 Nov 2026)
 * and could not be reproduced; this says when it happens and to whom.
 */
export const battleArtSchema = z
  .object({
    character: z.string().regex(/^[a-z0-9-]{1,32}$/),
    /** The fighter is the player's own. */
    mine: z.boolean(),
    textures: z.number().int().min(0).max(512),
    blank: z.number().int().min(0).max(512),
    /** What ran the check: the page shown again, a resumed connection, a
     * new battle renderer, a restored WebGL context. */
    trigger: z.enum(["visible", "resume", "renderer", "context"]),
    /** Loaded again (false: repaired twice already, left as it is). */
    repaired: z.boolean(),
    hidden: z.boolean().optional(),
    build: z
      .string()
      .regex(/^[a-z0-9-]{1,16}$/)
      .optional(),
    os: z
      .enum(["ios", "android", "mac", "windows", "linux", "other"])
      .optional(),
    app: z.boolean().optional(),
  })
  .strict();
export type BattleArt = z.infer<typeof battleArtSchema>;

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
    /** 99th percentile frame time, ms (older clients omit it). */
    frameP99: z.number().min(0).max(10_000).optional(),
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
    os: z
      .enum(["ios", "android", "mac", "windows", "linux", "other"])
      .optional(),
    app: z.boolean().optional(),
    /** The browser drew without the graphics card (client gpu-check.ts). */
    gpu: z.literal("software").optional(),
    /** The screen's refresh rate (Hz) as the battle measured it; battles
     * on screens of 100 Hz or more are held to about 60 fps (frame-cap.ts). */
    hz: z.number().int().min(1).max(1000).optional(),
    /** The longest snapshot gap (ms) and the median correction (px). */
    snapGapMax: z.number().min(0).max(60_000).optional(),
    correctionP50: z.number().min(0).max(100_000).optional(),
    /** Wi-Fi holds a minute (Fighter.held went above 0) and the most ticks held. */
    holds: z.number().min(0).max(100_000).optional(),
    holdMax: z.number().int().min(0).max(1_000).optional(),
    /** Inputs sent a second of live play (the phone's input clock: 30). */
    inputHz: z.number().min(0).max(1000).optional(),
    /** Wi-Fi or mobile data, and its speed class, where the browser says. */
    link: z.enum(["wifi", "cellular", "ethernet", "other"]).optional(),
    linkSpeed: z.enum(["slow-2g", "2g", "3g", "4g"]).optional(),
  })
  .strict();
export type BattlePerf = z.infer<typeof battlePerfSchema>;
