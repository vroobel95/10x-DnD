import { generateText, Output } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "astro:env/server";
import { GenerateResultSchema, type GenerateResult } from "@/lib/schemas/enemy";
import { BattleEnvironmentSchema, type BattleEnvironment } from "@/lib/schemas/environment";
import type { Battle } from "@/types";

const ENEMY_SYSTEM_PROMPT = `You are a D&D 5th Edition expert. Generate valid enemy stat blocks.
Rules:
- Ability scores: 1–30. HP: positive integer. AC: 1–30.
- CR must be appropriate for the given party level.
- Each ability must include a name and a one-line description with mechanics (e.g. damage dice, save DC).
- Return exactly as many enemies as requested.
Main villain rules:
- Only populate main_enemy when the prompt contains a distinctly named or uniquely typed creature that clearly stands apart as a boss or leader (e.g. "a vampire lord and 2 guards", "a bandit captain and bandits", "the necromancer"). The villain must be a different creature type or explicitly named — do NOT pick a "leader" from a group of identical creatures.
- description: 2–3 sentences on the villain's appearance and a backstory hook.
- tactics: 1–2 sentences on unique combat behavior and signature moves (flavor, not mechanics).
- dialogue: exactly 3 short, evocative in-character lines for GM use at the table.
- Set main_enemy to null when all creatures are of the same type or there is no clearly distinct boss (e.g. "3 goblins", "4 wolves", "2 bandits and 1 bandit"). Same creature type = no main villain, regardless of quantity.
Output JSON only.`;

const ENVIRONMENT_SYSTEM_PROMPT = `You are a D&D 5th Edition dungeon master. Generate vivid, atmospheric environment descriptions for a battle location.
Rules:
- Write evocative flavor text only — no mechanical rules, no damage dice, no action economy.
- Each field must be a distinct, sensory-rich 1-3 sentence description.
- terrain: the ground, structures, and physical features of the battlefield.
- lighting: natural or artificial light sources, shadows, visibility.
- hazards: environmental dangers or unstable elements (describe the hazard, not rules for it).
- ambiance: sounds, smells, temperature, and overall mood.
- trivia: an interesting historical, magical, or lore detail about this location.
Output JSON only.`;

// Steers the language of generated prose. Core D&D 5e game terms stay in English so
// Polish output keeps recognizable stat shorthand (AC/HP/STR…), matching the UI convention.
function languageDirective(locale: string): string {
  if (locale === "pl") {
    return `\nLanguage: Write all generated prose — names, descriptions, tactics, dialogue, and environment text — in Polish. Keep core D&D 5e game terms and stat abbreviations in English: ability scores (STR, DEX, CON, INT, WIS, CHA), AC, HP, CR, condition names, and dice notation (e.g. 2d6).`;
  }
  return "";
}

export async function generateEnemies(
  battle: Pick<Battle, "party_level" | "location"> & { environment: BattleEnvironment | null },
  prompt: string,
  locale: string,
): Promise<GenerateResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
  const contextParts = [
    battle.party_level != null ? `Party level: ${battle.party_level}` : null,
    battle.location ? `Location: ${battle.location}` : null,
    battle.environment ? `Environment: ${battle.environment.terrain}. ${battle.environment.hazards}.` : null,
  ].filter(Boolean);
  const fullPrompt = contextParts.length > 0 ? `${contextParts.join(". ")}. ${prompt}` : prompt;

  const { output } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.object({ schema: GenerateResultSchema }),
    system: ENEMY_SYSTEM_PROMPT + languageDirective(locale),
    prompt: fullPrompt,
  });

  return output;
}

export async function generateEnvironment(
  battle: Pick<Battle, "party_level" | "location">,
  locale: string,
): Promise<BattleEnvironment> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
  const contextParts = [
    battle.party_level != null ? `Party level: ${battle.party_level}` : null,
    battle.location ? `Location: ${battle.location}` : null,
  ].filter(Boolean);
  const prompt =
    contextParts.length > 0
      ? `Generate a battle environment for: ${contextParts.join(". ")}.`
      : "Generate a battle environment for a generic D&D encounter location.";

  const { output } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.object({ schema: BattleEnvironmentSchema }),
    system: ENVIRONMENT_SYSTEM_PROMPT + languageDirective(locale),
    prompt,
  });

  return output;
}
