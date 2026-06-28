import { z } from "zod";

const AbilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export const EnemySchema = z.object({
  name: z.string().min(1),
  cr: z.string().min(1),
  hp: z.number().int().min(1),
  ac: z.number().int().min(1).max(30),
  speed: z.string().min(1),
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
  saving_throws: z.record(z.string(), z.number()).optional(),
  skill_modifiers: z.record(z.string(), z.number()).optional(),
  abilities: z.array(AbilitySchema).min(0).max(10),
});

export const EnemyGroupSchema = z.object({
  enemies: z.array(EnemySchema).min(1).max(10),
});

export type EnemyStats = z.infer<typeof EnemySchema>;
export type EnemyGroup = z.infer<typeof EnemyGroupSchema>;

export const MainEnemyProfileSchema = z.object({
  description: z.string().min(1),
  tactics: z.string().min(1),
  dialogue: z.array(z.string().min(1)).length(3),
});

export const GenerateResultSchema = z.object({
  enemies: z.array(EnemySchema).min(1).max(10),
  main_enemy: z
    .object({
      enemy_name: z.string().min(1),
      profile: MainEnemyProfileSchema,
    })
    .nullable()
    .optional(),
});

export type MainEnemyProfile = z.infer<typeof MainEnemyProfileSchema>;
export type GenerateResult = z.infer<typeof GenerateResultSchema>;

// Adds a closing typographic quote when the AI omits it.
// Handles Polish/German „…" (U+201E → U+201D) and English "…" (U+201C → U+201D).
export function normalizeDialogueLine(line: string): string {
  const t = line.trimEnd();
  if ((t.startsWith("„") || t.startsWith("“")) && !t.endsWith("”")) {
    return t + "”";
  }
  return t;
}
