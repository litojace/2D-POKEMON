import { z } from "zod";
export const titleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
  description: z.string().max(160),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.boolean(),
});
export const accountSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(20),
  isAdmin: z.boolean(),
  suspended: z.boolean(),
  title: z.string().nullable(),
  titleColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  ownedTitles: z.array(titleSchema),
});
export type Account = z.infer<typeof accountSchema>;
export type Title = z.infer<typeof titleSchema>;
export interface ManagedPlayer {
  id: string;
  displayName: string;
  suspended: boolean;
  isAdmin: boolean;
  title: string | null;
  createdAt: string;
  titleIds: string[];
}
export interface PlayerDirectory {
  players: ManagedPlayer[];
  total: number;
}
export const playerUpdateSchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string().trim().min(1).max(20),
    suspended: z.boolean(),
  })
  .strict();
export const titleUpdateSchema = titleSchema
  .extend({
    id: z.string().uuid().nullable(),
    name: z.string().trim().min(1).max(40),
  })
  .strict();
export const titleGrantSchema = z
  .object({
    playerId: z.string().uuid(),
    titleId: z.string().uuid(),
    grant: z.boolean(),
  })
  .strict();
export const equipTitleSchema = z
  .object({ titleId: z.string().uuid().nullable() })
  .strict();
