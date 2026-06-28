import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import fontkit from "pdf-fontkit";

import { REGULAR_FONT, BOLD_FONT } from "./fonts";
import { EnemySchema, normalizeDialogueLine } from "@/lib/schemas/enemy";
import type { MainEnemyProfile } from "@/lib/schemas/enemy";
import { BattleEnvironmentSchema } from "@/lib/schemas/environment";
import type { Battle, Enemy } from "@/types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Ability score table layout constants
// Row 1 (stat name, 7pt): ~7pt pad top/bottom → height 22
// Row 2 (score 12pt + 4pt gap + modifier 9pt): ~6.5pt pad top/bottom → height 38
const STAT_ROW1_H = 22;
const STAT_ROW2_H = 38;
const STAT_TABLE_H = STAT_ROW1_H + STAT_ROW2_H; // 60

const STAT_NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const;
const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

// Split text into lines that fit within maxWidth, replicating pdf-lib's word-break
// algorithm. Rendering each line individually (without maxWidth) avoids a pdf-lib
// edge-case where the last glyph of a wrapped text block can be silently dropped.
function wrapText(text: string, pdfFont: PDFFont, size: number, maxWidth: number): string[] {
  const spaceW = pdfFont.widthOfTextAtSize(" ", size);
  const lines: string[] = [];
  let current = "";
  let currentW = 0;
  for (const word of text.split(" ")) {
    if (!word) continue;
    const wordW = pdfFont.widthOfTextAtSize(word, size);
    if (currentW === 0) {
      current = word;
      currentW = wordW;
    } else if (currentW + spaceW + wordW > maxWidth) {
      lines.push(current);
      current = word;
      currentW = wordW;
    } else {
      current += " " + word;
      currentW += spaceW + wordW;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function pdfFilename(name: string): string {
  const raw = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${raw.length > 0 ? raw : "battle"}.pdf`;
}

// Localized labels for the environment page, resolved by the caller (the export
// route) so this builder stays pure and i18n-free.
export interface EnvLabels {
  sectionTitle: string;
  terrain: string;
  lighting: string;
  hazards: string;
  ambiance: string;
  trivia: string;
  villainTitle?: string;
}

export async function buildBattlePdf(
  battle: Pick<Battle, "name"> & Partial<Pick<Battle, "environment">>,
  enemies: Enemy[],
  envLabels?: EnvLabels,
  villain?: { id: string; profile: MainEnemyProfile } | null,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(REGULAR_FONT, { subset: true });
  const fontBold = await pdfDoc.embedFont(BOLD_FONT, { subset: true });

  // Environment page (battle-level) leads the document when present and valid.
  // Re-validate the JSONB like the enemy stats below so a malformed environment
  // is skipped rather than aborting the whole document.
  const envParsed = battle.environment ? BattleEnvironmentSchema.safeParse(battle.environment) : null;
  if (envParsed?.success && envLabels) {
    const env = envParsed.data;
    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Battle name header (small, muted) — mirrors the enemy pages
    const headerSz = 8;
    page.drawText(battle.name, { x: MARGIN, y, size: headerSz, font, color: rgb(0.5, 0.5, 0.5) });
    y -= headerSz + 8;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 22;

    // Section title
    const titleSz = 20;
    page.drawText(envLabels.sectionTitle, { x: MARGIN, y, size: titleSz, font: fontBold, color: rgb(0, 0, 0) });
    y -= titleSz + 16;

    const fields: [string, string][] = [
      [envLabels.terrain, env.terrain],
      [envLabels.lighting, env.lighting],
      [envLabels.hazards, env.hazards],
      [envLabels.ambiance, env.ambiance],
      [envLabels.trivia, env.trivia],
    ];

    const labelSz = 10;
    const bodySz = 9;
    const lineH = bodySz + 3;

    for (const [label, body] of fields) {
      const bodyWrapped = wrapText(body, font, bodySz, CONTENT_W);
      const needed = labelSz + 3 + bodyWrapped.length * lineH + 12;
      // Continue onto a fresh page rather than clipping when a field overflows
      if (y - needed < MARGIN) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }

      page.drawText(label, { x: MARGIN, y, size: labelSz, font: fontBold, color: rgb(0, 0, 0) });
      y -= labelSz + 3;

      for (const bodyLine of bodyWrapped) {
        page.drawText(bodyLine, { x: MARGIN, y, size: bodySz, font, color: rgb(0.2, 0.2, 0.2) });
        y -= lineH;
      }
      y -= 12;
    }
  }

  for (const enemy of enemies) {
    const parsed = EnemySchema.safeParse(enemy.stats);
    if (!parsed.success) continue;

    const s = parsed.data;
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Battle name header (small, muted)
    const headerSz = 8;
    page.drawText(battle.name, {
      x: MARGIN,
      y,
      size: headerSz,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= headerSz + 8;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    // Extra gap so the 20pt creature name clears the rule
    y -= 22;

    // Enemy name + CR
    const nameSz = 20;
    page.drawText(s.name, {
      x: MARGIN,
      y,
      size: nameSz,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    const crLabel = `CR ${s.cr}`;
    const crSz = 10;
    const crW = font.widthOfTextAtSize(crLabel, crSz);
    page.drawText(crLabel, {
      x: PAGE_W - MARGIN - crW,
      y: y + 2,
      size: crSz,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= nameSz + 10;

    // HP / AC / Speed
    const statLineSz = 10;
    page.drawText(`HP ${s.hp}   AC ${s.ac}   Speed ${s.speed}`, {
      x: MARGIN,
      y,
      size: statLineSz,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= statLineSz + 14;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 14;

    // Ability score table
    const colW = CONTENT_W / 6;
    const tableTop = y;

    // Outer border
    page.drawRectangle({
      x: MARGIN,
      y: tableTop - STAT_TABLE_H,
      width: CONTENT_W,
      height: STAT_TABLE_H,
      borderWidth: 0.75,
      borderColor: rgb(0.65, 0.65, 0.65),
    });

    // Horizontal divider between stat name row and score row
    page.drawLine({
      start: { x: MARGIN, y: tableTop - STAT_ROW1_H },
      end: { x: PAGE_W - MARGIN, y: tableTop - STAT_ROW1_H },
      thickness: 0.5,
      color: rgb(0.65, 0.65, 0.65),
    });

    // Vertical dividers between columns
    for (let i = 1; i < 6; i++) {
      const vx = MARGIN + i * colW;
      page.drawLine({
        start: { x: vx, y: tableTop },
        end: { x: vx, y: tableTop - STAT_TABLE_H },
        thickness: 0.5,
        color: rgb(0.65, 0.65, 0.65),
      });
    }

    // Cell content
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const cx = MARGIN + i * colW + colW / 2;
      const val = s[STAT_KEYS[i]];
      const modStr = abilityMod(val);
      const fullName = STAT_NAMES[i];

      // Stat full name — row 1 (22pt tall), 7pt text, ~7pt pad top & bottom
      // baseline = tableTop - pad_top - cap_height = tableTop - 7.5 - 5 ≈ tableTop - 13
      const nameTextSz = 7;
      const nw = fontBold.widthOfTextAtSize(fullName, nameTextSz);
      page.drawText(fullName, {
        x: cx - nw / 2,
        y: tableTop - 13,
        size: nameTextSz,
        font: fontBold,
        color: rgb(0.35, 0.35, 0.35),
      });

      // Score — row 2 (38pt tall, top at tableTop - STAT_ROW1_H = tableTop - 22)
      // ~6.5pt pad top → cap top at tableTop - 28.5 → baseline ≈ tableTop - 37
      const scoreSz = 12;
      const vs = String(val);
      const vw = fontBold.widthOfTextAtSize(vs, scoreSz);
      page.drawText(vs, {
        x: cx - vw / 2,
        y: tableTop - STAT_ROW1_H - 15,
        size: scoreSz,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      // Modifier — below score with 4pt gap
      // score descender ≈ tableTop - 39.4; +4pt gap → mod baseline ≈ tableTop - 50
      const modSz = 9;
      const mw = font.widthOfTextAtSize(modStr, modSz);
      page.drawText(modStr, {
        x: cx - mw / 2,
        y: tableTop - STAT_ROW1_H - 15 - scoreSz - 4,
        size: modSz,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    y -= STAT_TABLE_H + 14;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 10;

    // Saving throws
    if (s.saving_throws && Object.keys(s.saving_throws).length > 0) {
      const savesStr =
        "Saving Throws: " +
        Object.entries(s.saving_throws)
          .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
          .join(", ");
      for (const saveLine of wrapText(savesStr, font, 9, CONTENT_W)) {
        page.drawText(saveLine, { x: MARGIN, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 12;
      }
      y -= 4;
    }

    // Skill modifiers
    if (s.skill_modifiers && Object.keys(s.skill_modifiers).length > 0) {
      const skillsStr =
        "Skills: " +
        Object.entries(s.skill_modifiers)
          .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
          .join(", ");
      for (const skillLine of wrapText(skillsStr, font, 9, CONTENT_W)) {
        page.drawText(skillLine, { x: MARGIN, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 12;
      }
      y -= 4;
    }

    // Abilities
    if (s.abilities.length > 0) {
      const hasSavesOrSkills =
        Object.keys(s.saving_throws ?? {}).length > 0 || Object.keys(s.skill_modifiers ?? {}).length > 0;
      if (hasSavesOrSkills) y -= 4;

      for (const ability of s.abilities) {
        if (y < MARGIN) break;
        const abilityNameSz = 10;
        const descSz = 9;
        const lineH = descSz + 3;

        page.drawText(`${ability.name}.`, {
          x: MARGIN,
          y,
          size: abilityNameSz,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        y -= abilityNameSz + 3;

        for (const descLine of wrapText(ability.description, font, descSz, CONTENT_W)) {
          page.drawText(descLine, { x: MARGIN, y, size: descSz, font, color: rgb(0.2, 0.2, 0.2) });
          y -= lineH;
        }
        y -= 6;
      }
    }

    // Main villain profile section — rendered after abilities when this enemy is the main villain.
    if (enemy.id === villain?.id) {
      const vp = villain.profile;
      const profileSz = 9;
      const profileLineH = profileSz + 3;

      if (y >= MARGIN) {
        y -= 8;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_W - MARGIN, y },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        y -= 12;
      }

      if (y >= MARGIN) {
        const titleText = (envLabels?.villainTitle ?? "Main Villain").toUpperCase();
        page.drawText(titleText, { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.55, 0.38, 0.0) });
        y -= 9 + 6;
      }

      if (y >= MARGIN) {
        for (const descLine of wrapText(vp.description, font, profileSz, CONTENT_W)) {
          if (y < MARGIN) break;
          page.drawText(descLine, { x: MARGIN, y, size: profileSz, font, color: rgb(0.15, 0.15, 0.15) });
          y -= profileLineH;
        }
        y -= 6;
      }

      if (y >= MARGIN) {
        for (const tacLine of wrapText(vp.tactics, font, profileSz, CONTENT_W)) {
          if (y < MARGIN) break;
          page.drawText(tacLine, { x: MARGIN, y, size: profileSz, font, color: rgb(0.35, 0.35, 0.35) });
          y -= profileLineH;
        }
        y -= 6;
      }

      for (const rawLine of vp.dialogue) {
        if (y < MARGIN) break;
        for (const dialogueLine of wrapText(normalizeDialogueLine(rawLine), font, profileSz, CONTENT_W)) {
          if (y < MARGIN) break;
          page.drawText(dialogueLine, { x: MARGIN, y, size: profileSz, font, color: rgb(0.25, 0.25, 0.25) });
          y -= profileLineH;
        }
        y -= 4;
      }
    }
  }

  return pdfDoc.save();
}
