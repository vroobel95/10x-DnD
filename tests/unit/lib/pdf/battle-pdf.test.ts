import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildBattlePdf, pdfFilename } from "@/lib/pdf/battle-pdf";
import type { Enemy } from "@/types";

const BATTLE = { name: "Frozen Cave Ambush" };

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
