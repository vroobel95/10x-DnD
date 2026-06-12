import { z } from "zod";

export const BattleEnvironmentSchema = z.object({
  terrain: z.string().min(1),
  lighting: z.string().min(1),
  hazards: z.string().min(1),
  ambiance: z.string().min(1),
  trivia: z.string().min(1),
});

export type BattleEnvironment = z.infer<typeof BattleEnvironmentSchema>;
