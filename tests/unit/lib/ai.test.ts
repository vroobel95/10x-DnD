import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture what gets passed to the model without making a real API call.
const generateTextMock = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  Output: { object: vi.fn(() => ({})) },
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: () => () => "mock-model",
}));

import { generateEnemies, generateEnvironment } from "@/lib/ai";

interface GenerateArgs {
  system: string;
  prompt: string;
}

function lastCallArgs(): GenerateArgs {
  const calls = generateTextMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as GenerateArgs;
}

beforeEach(() => {
  generateTextMock.mockReset();
  generateTextMock.mockResolvedValue({
    output: { terrain: "", lighting: "", hazards: "", ambiance: "", trivia: "" },
  });
});

describe("language steering", () => {
  it("leads the system prompt with a hard Polish rule and mirrors it into the user prompt (pl)", async () => {
    await generateEnvironment({ party_level: 3, location: "Mroczny las" }, "pl");

    const { system, prompt } = lastCallArgs();
    // The rule must come BEFORE the task instructions — a trailing directive was the bug.
    expect(system.startsWith("LANGUAGE (HARD RULE):")).toBe(true);
    expect(system).toMatch(/in Polish/);
    expect(system.indexOf("Polish")).toBeLessThan(system.indexOf("dungeon master"));
    // And it is co-located with the task in the user prompt.
    expect(prompt).toMatch(/in Polish/);
  });

  it("applies the same Polish steering to enemy generation (pl)", async () => {
    generateTextMock.mockResolvedValue({ output: { enemies: [], main_enemy: null } });
    await generateEnemies({ party_level: 3, location: "Las", environment: null }, "3 goblins", "pl");

    const { system, prompt } = lastCallArgs();
    expect(system.startsWith("LANGUAGE (HARD RULE):")).toBe(true);
    expect(prompt).toMatch(/in Polish/);
  });

  it("adds no language directive for the base locale (en)", async () => {
    await generateEnvironment({ party_level: 3, location: "Forest" }, "en");

    const { system, prompt } = lastCallArgs();
    expect(system).not.toMatch(/Polish/);
    expect(system.startsWith("You are a D&D")).toBe(true);
    expect(prompt).not.toMatch(/Polish/);
  });
});
