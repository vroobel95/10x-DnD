import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { EnemySchema } from "@/lib/schemas/enemy";
import type { Battle, Enemy } from "@/types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

export function pdfFilename(name: string): string {
  const raw = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${raw.length > 0 ? raw : "battle"}.pdf`;
}

export async function buildBattlePdf(battle: Pick<Battle, "name">, enemies: Enemy[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
    y -= headerSz + 6;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 14;

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
    y -= statLineSz + 12;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 14;

    // Ability score grid (6 columns)
    const attrs = ["str", "dex", "con", "int", "wis", "cha"] as const;
    const labelSz = 8;
    const valSz = 11;
    const modSz = 8;
    const colW = CONTENT_W / 6;

    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const cx = MARGIN + i * colW + colW / 2;
      const label = attr.toUpperCase();
      const val = s[attr];
      const modStr = abilityMod(val);

      const lw = fontBold.widthOfTextAtSize(label, labelSz);
      page.drawText(label, {
        x: cx - lw / 2,
        y,
        size: labelSz,
        font: fontBold,
        color: rgb(0.4, 0.4, 0.4),
      });

      const vs = String(val);
      const vw = fontBold.widthOfTextAtSize(vs, valSz);
      page.drawText(vs, {
        x: cx - vw / 2,
        y: y - labelSz - 3,
        size: valSz,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      const mw = font.widthOfTextAtSize(modStr, modSz);
      page.drawText(modStr, {
        x: cx - mw / 2,
        y: y - labelSz - 3 - valSz - 3,
        size: modSz,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    y -= labelSz + 3 + valSz + 3 + modSz + 14;

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
      page.drawText(savesStr, {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: CONTENT_W,
      });
      const savesW = font.widthOfTextAtSize(savesStr, 9);
      y -= Math.max(1, Math.ceil(savesW / CONTENT_W)) * 12 + 4;
    }

    // Skill modifiers
    if (s.skill_modifiers && Object.keys(s.skill_modifiers).length > 0) {
      const skillsStr =
        "Skills: " +
        Object.entries(s.skill_modifiers)
          .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
          .join(", ");
      page.drawText(skillsStr, {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: CONTENT_W,
      });
      const skillsW = font.widthOfTextAtSize(skillsStr, 9);
      y -= Math.max(1, Math.ceil(skillsW / CONTENT_W)) * 12 + 4;
    }

    // Abilities
    if (s.abilities.length > 0) {
      const hasSavesOrSkills =
        Object.keys(s.saving_throws ?? {}).length > 0 || Object.keys(s.skill_modifiers ?? {}).length > 0;
      if (hasSavesOrSkills) y -= 4;

      for (const ability of s.abilities) {
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

        page.drawText(ability.description, {
          x: MARGIN,
          y,
          size: descSz,
          font,
          color: rgb(0.2, 0.2, 0.2),
          maxWidth: CONTENT_W,
          lineHeight: lineH,
        });

        const descW = font.widthOfTextAtSize(ability.description, descSz);
        const descLines = Math.max(1, Math.ceil(descW / CONTENT_W));
        y -= descLines * lineH + 6;
      }
    }
  }

  return pdfDoc.save();
}
