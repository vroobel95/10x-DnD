import { z } from 'zod';

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
