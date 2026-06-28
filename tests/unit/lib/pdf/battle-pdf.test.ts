import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildBattlePdf, pdfFilename, type EnvLabels } from "@/lib/pdf/battle-pdf";
import type { BattleEnvironment, Enemy } from "@/types";

const BATTLE = { name: "Frozen Cave Ambush", environment: null };

const ENV_LABELS: EnvLabels = {
  sectionTitle: "Environment",
  terrain: "Terrain",
  lighting: "Lighting",
  hazards: "Hazards",
  ambiance: "Ambiance",
  trivia: "Trivia",
};

const ENVIRONMENT: BattleEnvironment = {
  terrain: "Jagged ice shelves over a frozen underground lake.",
  lighting: "Dim — phosphorescent lichen casts a pale blue glow.",
  hazards: "Thin ice cracks under heavy creatures; DC 13 Dexterity save.",
  ambiance: "A low groan of shifting ice echoes through the cavern.",
  trivia: "Smugglers once cached goods beneath the lake here.",
};

const BASE_STATS: Record<string, unknown> = {
  name: "Goblin",
  cr: "1/4",
  hp: 7,
  ac: 15,
  speed: "30 ft.",
  str: 8,
  dex: 14,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  abilities: [],
};

function makeEnemy(id: string, stats: Record<string, unknown> | null = BASE_STATS): Enemy {
  return {
    id,
    battle_id: "b-1",
    name: "Goblin",
    status: "confirmed",
    stats,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("buildBattlePdf", () => {
  it("returns bytes starting with %PDF- signature", async () => {
    const bytes = await buildBattlePdf(BATTLE, [makeEnemy("e-1")]);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("produces one page per valid enemy", async () => {
    const bytes = await buildBattlePdf(BATTLE, [makeEnemy("e-1"), makeEnemy("e-2")]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("renders optional saving_throws and skill_modifiers without throwing", async () => {
    const bytes = await buildBattlePdf(BATTLE, [
      makeEnemy("e-1", {
        ...BASE_STATS,
        saving_throws: { STR: 2, WIS: -1 },
        skill_modifiers: { Stealth: 4 },
      }),
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("renders many long abilities without throwing", async () => {
    const longDesc =
      "This creature can perform a remarkable feat that spans many words and would normally wrap across multiple lines on a standard page layout.";
    const bytes = await buildBattlePdf(BATTLE, [
      makeEnemy("e-1", {
        ...BASE_STATS,
        abilities: Array.from({ length: 5 }, (_, i) => ({
          name: `Ability ${i + 1}`,
          description: longDesc,
        })),
      }),
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("skips enemies with invalid stats instead of throwing", async () => {
    const valid = makeEnemy("e-1");
    const invalid = makeEnemy("e-2", { name: "", hp: -99 });
    const bytes = await buildBattlePdf(BATTLE, [valid, invalid]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("adds one leading environment page when an environment is present", async () => {
    const battle = { name: "Frozen Cave Ambush", environment: ENVIRONMENT };
    const bytes = await buildBattlePdf(battle, [makeEnemy("e-1"), makeEnemy("e-2")], ENV_LABELS);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3); // 1 environment page + 2 enemy pages
  });

  it("renders no environment page when environment is null", async () => {
    const bytes = await buildBattlePdf(BATTLE, [makeEnemy("e-1"), makeEnemy("e-2")], ENV_LABELS);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2); // enemy pages only
  });

  it("skips the environment page when the environment fails validation instead of throwing", async () => {
    // Malformed JSONB (missing lighting/hazards/ambiance/trivia) — must not abort the document
    const battle = { name: "Frozen Cave Ambush", environment: { terrain: "Ice" } as unknown as BattleEnvironment };
    const bytes = await buildBattlePdf(battle, [makeEnemy("e-1")], ENV_LABELS);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1); // enemy page only, env page skipped
  });

  it("resolves for Polish enemy text (Latin Extended-A characters)", async () => {
    const battle = { name: "Lodowe Jaskinie", environment: null };
    const bytes = await buildBattlePdf(battle, [
      makeEnemy("e-pl", {
        ...BASE_STATS,
        name: "Strażnik Śniegu",
        abilities: [
          {
            name: "Śnieżna Aura",
            description: "Zadaje obrażenia wszystkim wrogom w promieniu 5 stóp od strażnika.",
          },
        ],
      }),
    ]);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("resolves with Polish environment labels and content", async () => {
    const battle = {
      name: "Zamarznięte Jaskinie",
      environment: {
        ...ENVIRONMENT,
        terrain: "Pokryta lodem skała z ostrymi krawędziami.",
      } satisfies BattleEnvironment,
    };
    const polishLabels: EnvLabels = {
      sectionTitle: "Środowisko",
      terrain: "Teren",
      lighting: "Oświetlenie",
      hazards: "Zagrożenia",
      ambiance: "Klimat",
      trivia: "Ciekawostki",
    };
    const bytes = await buildBattlePdf(battle, [makeEnemy("e-1")], polishLabels);
    const doc = await PDFDocument.load(bytes);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("wraps and paginates very long environment fields without throwing", async () => {
    const long = "Ancient frost-rimed stone. ".repeat(70).trim(); // ~1900 chars, near the 2000 max
    const battle = {
      name: "Frozen Cave Ambush",
      environment: {
        terrain: long,
        lighting: long,
        hazards: long,
        ambiance: long,
        trivia: long,
      } satisfies BattleEnvironment,
    };
    const bytes = await buildBattlePdf(battle, [makeEnemy("e-1")], ENV_LABELS);
    const doc = await PDFDocument.load(bytes);
    // Five near-max fields overflow one page → at least 2 environment pages + 1 enemy page
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});

describe("pdfFilename", () => {
  it("converts spaces and uppercase to a lowercase hyphenated filename", () => {
    expect(pdfFilename("Frozen Cave Ambush")).toBe("frozen-cave-ambush.pdf");
  });

  it("strips leading and trailing whitespace-derived hyphens", () => {
    expect(pdfFilename("  Cave  ")).toBe("cave.pdf");
  });

  it("falls back to battle.pdf for an empty name", () => {
    expect(pdfFilename("")).toBe("battle.pdf");
  });

  it("falls back to battle.pdf for a purely non-alphanumeric name", () => {
    expect(pdfFilename("!@#$%")).toBe("battle.pdf");
  });
});
