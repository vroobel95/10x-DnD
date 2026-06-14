---
title: pdf-lib API reference (for PDF export)
source: Context7 — /websites/pdf-lib_js (official docs, https://pdf-lib.js.org)
retrieved: 2026-06-14
change_id: pdf-export
scope: Cloudflare Workers (workerd) — pure JS, no filesystem, return bytes
---

# pdf-lib — API reference

Curated from the official pdf-lib docs via Context7, scoped to what the
`pdf-export` feature needs: build a PDF in-memory in a Cloudflare Worker and
return the bytes. See [research.md](research.md) for why pdf-lib was chosen.

Package: `pdf-lib` (add with `npm i pdf-lib`). Custom fonts only:
`npm i @pdf-lib/fontkit`. **No filesystem on Workers** — never use
`fs.readFileSync`; use `fetch(...).then(r => r.arrayBuffer())` or bundled bytes.

## Minimal create → text → bytes

```javascript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

async function createPdf() {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica) // built-in, no file needed

  const page = pdfDoc.addPage()                 // default page size
  const { width, height } = page.getSize()
  const fontSize = 30

  page.drawText('Creating PDFs in JavaScript is awesome!', {
    x: 50,
    y: height - 4 * fontSize,                   // origin is BOTTOM-left; y grows upward
    size: fontSize,
    font,
    color: rgb(0, 0.53, 0.71),
  })

  const pdfBytes = await pdfDoc.save()          // Uint8Array — return this from the route
  return pdfBytes
}
```

Returning from an Astro/Workers API route:

```javascript
return new Response(pdfBytes, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="battle-<id>.pdf"',
  },
})
```

## Coordinate system & page sizes

- Origin `(0, 0)` is the **lower-left** corner; `y` increases upward. To place
  things from the top, compute `y = height - offset`.
- `page.getSize()` → `{ width, height }`; `page.getWidth()`, `page.getHeight()`.
- `pdfDoc.addPage()` for default; `pdfDoc.addPage([widthPt, heightPt])` for a custom
  size (points; 1 inch = 72 pt, so US Letter = `[612, 792]`, A4 = `[595.28, 841.89]`).
- One page per enemy card → call `addPage()` per confirmed enemy.

## Drawing text

```javascript
import { StandardFonts, rgb } from 'pdf-lib'

const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)

const page = pdfDoc.addPage()
page.setFont(helveticaFont)        // default font for subsequent drawText calls

page.moveTo(5, 200)
page.drawText('The Life of an Egg', { size: 36 })
page.moveDown(36)                  // moves the cursor down by 36
page.drawText('An Epic Tale of Woe', { size: 30 })

// Multi-line: embed \n and set lineHeight
page.drawText(
  `Humpty Dumpty sat on a wall \n` +
  `Humpty Dumpty had a great fall; \n`,
  { x: 25, y: 100, font: timesRomanFont, size: 24, color: rgb(1, 0, 0), lineHeight: 24, opacity: 0.75 },
)
```

`drawText` options (`PDFPageDrawTextOptions`, all optional except the text):
`x`, `y`, `font`, `size`, `color`, `lineHeight`, `opacity`, `rotate`,
`maxWidth` (auto-wraps), `wordBreaks` (string[]), `blendMode`, `xSkew`, `ySkew`.

## Standard (built-in) fonts — preferred on Workers

No font file needed; ideal when there's no filesystem:

```javascript
import { StandardFonts } from 'pdf-lib'
const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
// Also: Helvetica(Bold|Oblique), TimesRoman, Courier, Symbol, ZapfDingbats, etc.
```

## Measuring text (for layout / wrapping / right-align)

```javascript
const textWidth  = font.widthOfTextAtSize(text, size)
const textHeight = font.heightAtSize(size)
```

Use these to right-align CR/HP/AC, fit text inside a card boundary, or hand-roll
wrapping when `maxWidth` isn't enough.

## Drawing rectangles & lines (card borders, dividers)

```javascript
import { degrees, grayscale, rgb } from 'pdf-lib'

page.drawRectangle({
  x: 25, y: 75, width: 250, height: 75,
  rotate: degrees(-15),          // optional
  borderWidth: 5,
  borderColor: grayscale(0.5),
  color: rgb(0.75, 0.2, 0.2),    // fill
  opacity: 0.5,
  borderOpacity: 0.75,
})

// Lines available via page.drawLine({ start: {x,y}, end: {x,y}, thickness, color })
```

Colors: `rgb(r, g, b)` (0–1 range), `grayscale(0–1)`, `cmyk(...)`.

## Custom fonts (only if a typeface beyond the standard 14 is required)

Adds `@pdf-lib/fontkit`; fetch font bytes at runtime (no fs on Workers):

```javascript
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const fontBytes = await fetch('https://.../Ubuntu-R.ttf').then(r => r.arrayBuffer())
const pdfDoc = await PDFDocument.create()
pdfDoc.registerFontkit(fontkit)
const customFont = await pdfDoc.embedFont(fontBytes)

const text = 'This is text in an embedded font!'
const size = 35
const w = customFont.widthOfTextAtSize(text, size)
const h = customFont.heightAtSize(size)
page.drawText(text, { x: 40, y: 450, size, font: customFont, color: rgb(0, 0.53, 0.71) })
```

`embedFont` accepts: `StandardFonts.*`, a base64 string, a data URI, a
`Uint8Array`, or an `ArrayBuffer`.

## Images (PNG/JPG) — if a card needs a portrait/icon

```javascript
const jpgBytes = await fetch(jpgUrl).then(r => r.arrayBuffer())
const pngBytes = await fetch(pngUrl).then(r => r.arrayBuffer())
const jpgImage = await pdfDoc.embedJpg(jpgBytes)
const pngImage = await pdfDoc.embedPng(pngBytes)
const dims = jpgImage.scale(0.5)
page.drawImage(jpgImage, { x: 100, y: 100, width: dims.width, height: dims.height })
```

## Saving

```javascript
const pdfBytes = await pdfDoc.save()   // Uint8Array; write to file, Blob, Response, or iframe
```

## Notes for this feature

- Built-in `StandardFonts.Helvetica` covers the stat-block — avoids font embedding
  and keeps the Workers bundle small. Reach for `@pdf-lib/fontkit` only for a custom
  typeface.
- pdf-lib has **no high-level layout engine** — position every element with explicit
  `(x, y)`. Use `widthOfTextAtSize` / `heightAtSize` for alignment and to keep content
  inside the card. If manual layout gets unwieldy, `boxpdf` (flexbox-lite over pdf-lib)
  is the escalation noted in [research.md](research.md), not a library swap.
- Remember the bottom-left origin when translating the [EnemyCard.tsx](../../../src/components/battles/EnemyCard.tsx)
  top-down visual order into draw calls.
