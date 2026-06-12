import { z } from "zod";

export const BattleEnvironmentSchema = z.object({
  terrain: z.string().min(1).max(2000),
  lighting: z.string().min(1).max(2000),
  hazards: z.string().min(1).max(2000),
  ambiance: z.string().min(1).max(2000),
  trivia: z.string().min(1).max(2000),
});

export type BattleEnvironment = z.infer<typeof BattleEnvironmentSchema>;
