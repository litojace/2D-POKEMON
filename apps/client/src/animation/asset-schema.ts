import { z } from "zod";
const file = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_./-]+$/, "Use simple asset filenames")
  .refine(
    (v) => !v.includes("..") && !v.includes(":") && !v.startsWith("/"),
    "Use a path relative to this fighter's asset folder",
  );
const animation = z
  .object({
    frames: z
      .array(z.union([z.string().min(1), z.number().int().nonnegative()]))
      .min(1),
    fps: z.number().min(1).max(60),
    loop: z.boolean().default(false),
  })
  .strict();
const common = {
  schemaVersion: z.literal(1),
  portrait: file,
  selection: file,
  artStatus: z.string().min(1),
};
export const fighterPackSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...common, kind: z.literal("layered") }).strict(),
    z
      .object({
        ...common,
        kind: z.literal("frames"),
        files: z.record(z.string(), file),
        animations: z.record(z.string(), animation),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("sheet"),
        image: file,
        frameWidth: z.number().int().min(1).max(2048),
        frameHeight: z.number().int().min(1).max(2048),
        animations: z.record(z.string(), animation),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("atlas"),
        image: file,
        data: file,
        animations: z.record(z.string(), animation),
      })
      .strict(),
  ])
  .superRefine((pack, ctx) => {
    if (pack.kind === "layered") return;
    for (const dir of ["up", "down", "left", "right"])
      if (!pack.animations[`idle-${dir}`])
        ctx.addIssue({ code: "custom", message: `Missing idle-${dir}` });
    for (const [key, a] of Object.entries(pack.animations)) {
      if (
        !/^(idle|blink|walk|run|basic|skill[0-3]|dash|jump|land|hurt|defeat|victory|wave)-(up|down|left|right)$/.test(
          key,
        )
      )
        ctx.addIssue({
          code: "custom",
          message: `Invalid animation key ${key}`,
        });
      if (
        pack.kind === "frames" &&
        a.frames.some(
          (frame) =>
            typeof frame !== "string" || !Object.hasOwn(pack.files, frame),
        )
      )
        ctx.addIssue({ code: "custom", message: `Missing frame in ${key}` });
      if (
        pack.kind === "sheet" &&
        a.frames.some((frame) => typeof frame !== "number")
      )
        ctx.addIssue({
          code: "custom",
          message: `Sheet frames must be numbers in ${key}`,
        });
      if (
        pack.kind === "atlas" &&
        a.frames.some((frame) => typeof frame !== "string")
      )
        ctx.addIssue({
          code: "custom",
          message: `Atlas frames must be named in ${key}`,
        });
    }
  });
export type FighterPack = z.infer<typeof fighterPackSchema>;
