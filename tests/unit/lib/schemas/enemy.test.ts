import { describe, it, expect } from "vitest";
import { EnemySchema, EnemyGroupSchema, normalizeDialogueLine } from "@/lib/schemas/enemy";

const baseline = {
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

describe("EnemySchema", () => {
  it("accepts a valid baseline enemy", () => {
    expect(EnemySchema.safeParse(baseline).success).toBe(true);
  });

  describe("str (ability score constraint: 1–30)", () => {
    it("rejects str: 0", () => {
      expect(EnemySchema.safeParse({ ...baseline, str: 0 }).success).toBe(false);
    });

    it("rejects str: 31", () => {
      expect(EnemySchema.safeParse({ ...baseline, str: 31 }).success).toBe(false);
    });

    it("accepts str: 1 (lower bound)", () => {
      expect(EnemySchema.safeParse({ ...baseline, str: 1 }).success).toBe(true);
    });

    it("accepts str: 30 (upper bound)", () => {
      expect(EnemySchema.safeParse({ ...baseline, str: 30 }).success).toBe(true);
    });
  });

  describe("dex (spot-check — same constraint as str)", () => {
    it("rejects dex: 0", () => {
      expect(EnemySchema.safeParse({ ...baseline, dex: 0 }).success).toBe(false);
    });

    it("rejects dex: 31", () => {
      expect(EnemySchema.safeParse({ ...baseline, dex: 31 }).success).toBe(false);
    });
  });

  describe("hp (min 1, no upper bound)", () => {
    it("rejects hp: 0", () => {
      expect(EnemySchema.safeParse({ ...baseline, hp: 0 }).success).toBe(false);
    });

    it("accepts hp: 1 (lower bound)", () => {
      expect(EnemySchema.safeParse({ ...baseline, hp: 1 }).success).toBe(true);
    });
  });

  describe("ac (schema enforces min 1, stricter than PRD's ≥ 0)", () => {
    it("rejects ac: 0", () => {
      expect(EnemySchema.safeParse({ ...baseline, ac: 0 }).success).toBe(false);
    });

    it("accepts ac: 1 (lower bound)", () => {
      expect(EnemySchema.safeParse({ ...baseline, ac: 1 }).success).toBe(true);
    });
  });

  describe("cr (non-empty string)", () => {
    it("rejects cr: empty string", () => {
      expect(EnemySchema.safeParse({ ...baseline, cr: "" }).success).toBe(false);
    });

    it('accepts cr: "1/8"', () => {
      expect(EnemySchema.safeParse({ ...baseline, cr: "1/8" }).success).toBe(true);
    });
  });

  describe("name (non-empty string)", () => {
    it("rejects name: empty string", () => {
      expect(EnemySchema.safeParse({ ...baseline, name: "" }).success).toBe(false);
    });
  });

  describe("abilities (max 10)", () => {
    it("rejects abilities array with 11 items", () => {
      const abilities = Array.from({ length: 11 }, (_, i) => ({
        name: `Ability ${i}`,
        description: "Does something.",
      }));
      expect(EnemySchema.safeParse({ ...baseline, abilities }).success).toBe(false);
    });
  });
});

describe("EnemyGroupSchema", () => {
  it("rejects enemies: [] (min is 1)", () => {
    expect(EnemyGroupSchema.safeParse({ enemies: [] }).success).toBe(false);
  });

  it("accepts a group with one valid enemy", () => {
    expect(EnemyGroupSchema.safeParse({ enemies: [baseline] }).success).toBe(true);
  });
});

describe("normalizeDialogueLine", () => {
  it("appends a closing quote when a Polish „ opener is unclosed", () => {
    expect(normalizeDialogueLine("„Ciepło... czuję wasze ciepło")).toBe("„Ciepło... czuję wasze ciepło”");
  });

  it("appends a closing quote when an English “ opener is unclosed", () => {
    expect(normalizeDialogueLine("“You should not have come here")).toBe("“You should not have come here”");
  });

  it("leaves an already-closed line unchanged", () => {
    expect(normalizeDialogueLine("„Witaj, śmiałku.”")).toBe("„Witaj, śmiałku.”");
  });

  it("trims trailing whitespace before deciding on the closing quote", () => {
    expect(normalizeDialogueLine("„Zginiesz tutaj.   ")).toBe("„Zginiesz tutaj.”");
  });

  it("passes through a line with no typographic opener (straight quotes / none)", () => {
    expect(normalizeDialogueLine('"Plain ascii quotes"')).toBe('"Plain ascii quotes"');
    expect(normalizeDialogueLine("No quotes at all")).toBe("No quotes at all");
  });
});
