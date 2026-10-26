# Pawtopia — Design system

Direction: boutique storybook meets a calm modern puzzle app. Warm ivory surfaces, one teal action color, coral and
gold used sparingly for warmth and achievement, soft region pastels that keep dark facial features legible.

## Tokens (`src/ui/styles/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#FBF8F1` | App background |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--ink` / `--muted-ink` | `#283434` / `#56665F` | Text |
| `--brand` / `--brand-dark` | `#287B70` / `#185C55` | The only action color; pressed edge |
| `--coral` | `#EB8978` | Daily, hearts, warmth |
| `--gold` | `#D5A04B` | Coins, stars, badges only |
| `--r0`…`--r8` | lavender, mint, apricot, sky, blush, butter, sage, sea glass, periwinkle | Board regions |
| `--error` | `#C85050` | Mistakes (always with a hatch + ring, never color alone) |

High-contrast mode deepens ink, dividers and region saturation. Region patterns add a texture per region.

## Type

Fredoka (display: headings, numbers on buttons) and Nunito Sans (UI), both OFL, self-hosted for offline. Sizes:
12 / 14 / 16 / 19 / 24 / 32. Tabular numerals (`.num`) for timers, scores and counts.

## Geometry & depth

Max content width 520px; 16px side gutters plus safe areas. Card radius 20, inner 14, sheets 24. Soft warm shadows
with an engraved top highlight; primary buttons have a 2px pressed edge and drop 2px when pressed.

## Board

Cells are flat region colors; grid lines and thick region dividers are one SVG overlay so stroke weight is identical
everywhere and nothing shifts when a tile changes. Feedback (fresh ring, completed-line glow, mistake hatch, hint
focus, tutorial pulse) lives on each cell's `::before` overlay, never on the pet. Givens get a lock badge and an
embossed plate. Cells are sized from the available zone (26–76px); 9×9 fits a 320px phone.

## Motion

Screen fade 160ms, sheet rise 200ms, press 100ms, coin pop ~420ms. Faces: transitions between poses only (no loops),
blink 140–220ms every 4–9 s, reactions 250–650ms, win wave ≤1.5 s. `prefers-reduced-motion` (or the in-app setting)
removes transitions and idle blinks; expressions then change instantly.

## Characters

Two rig templates (cat, dog), 64×64, consistent 1.4px outline at 34% ink, eyes at fixed positions so expressions
read at 32–55px. Six residents vary by ears (round, pointed, tufted, floppy, folded, button), markings (tabby, mask,
patch, blaze), palette and personality poses. Outside the board, pets are static.

## Voice

Short, warm, specific. One coaching sentence near the board, never a wall of text. No pressure copy, no fake urgency,
no "you'll lose everything". Honest labels for anything not live ("Practice score", "Not available", "Preview").
