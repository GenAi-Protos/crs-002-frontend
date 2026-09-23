# Brand and copy

For the September 2026 requested feature slice, concise operational notices are allowed when they explain a user decision: private evidence promotion, partial extraction, unavailable sources, revision conflicts, approval gates and retry. These notices must name the state and next action. All existing brand tokens and accessible status treatments remain in force.

---

## 1 · Writing rules

The last build was rejected partly for text volume. These are limits, not guidance.

| Thing | Limit |
|---|---|
| Page header | **1 to 3 words. A noun.** `Reports`. `Clients`. Not a sentence. |
| Description under a header | **Does not exist.** Do not add a `description` prop to `PageHeader`. If a screen needs explaining, it is the wrong screen. |
| Explanatory paragraph anywhere on screen | **None.** Rationale lives in these docs and in code comments. |
| Column header | 1 to 2 words. No prose tooltips. |
| Empty state | **One line, 8 words maximum**, plus one action. The fact, not the philosophy. |
| Error | One sentence naming the thing and the fix. Anchor-linked to the offending block. |
| Success | **Nothing**, or `All checks passed.` |
| Numbers | Always render the count, **including zero**. Never `no data available`. |
| Hedging | **Banned.** No `TBC`, `pending confirmation`, `per draft`, `built against fixtures`. That goes to `docs/04`, not the screen. |

**Before and after, from the build that was rejected:**

| Before | After |
|---|---|
| `Priority Intelligence Requirements` / *"The 24 standing requirements, verbatim from CPX's PIRs.xlsx. The agent consumes PIRs but does not manage or define them - PIR definition is out of scope in writing (10 June)."* | **`Requirements`** - the out-of-scope fact is enforced by there being no edit control. It does not need saying. |
| `Collection and integrations` / *"What we collect, from where, how often, under what auth, with what retention, and whether Anomali already carries it. Built against fixtures: the Anomali MCP is unverified and the commercial keys have no date."* | **`Collection`** - "unverified" is a badge on one card. "No key" is that card reading `Not connected`. |
| Six stacked validator rows each with a Pass pill, plus a chart comparing four numbers already in a table two rows above | **`All checks passed.`** |
| `No clients yet. CPX has not supplied a client register.` | **`No clients yet.`** - the second sentence is a procurement fact nobody on screen can act on. |

---

## 2 · Colour

### Core

| Token | Hex | Use |
|---|---|---|
| Dark Purple | `#1E1847` | Primary brand. Dark surfaces, headings, the top bar. |
| CPX Green | `#4CEE76` | The single eye-catcher. Primary CTA, live status. **Near-black text on green, never white.** |
| Near Black | `#040405` | Body text |
| Bright Purple | `#5C5CC0` | Secondary, and the agent's colour |
| Just Grey | `#333333` | Secondary text |
| Accent Red | `#FF3666` | Critical only |
| Accent Blue | `#3AC2FF` | Base is 1.9:1 on white: chrome and chart use only, never text. |
| Link | `#0276B0` | Links in content (`text-link`). Accent Blue 700, 5:1 on white. Never a chart slot. |
| Canvas, Band, Rule, Inset | `#FFFFFF` `#F7F7F8` `#ECECEF` `#F7F7F8` | Page (white), table header band, hairlines, empty heatmap cells. No screen carries a grey hex of its own. |

### Tint scales

Every brand colour carries the 50 to 900 scale the other CPX consoles use (CSD-007 style guide 2.2), as `cpx-green-*`, `cpx-blue-*`, `cpx-red-*`, `cpx-bright-*` and `cpx-grey-*` in `app/globals.css`. The rule of thumb: 50 and 100 are fills and borders, 700 and 800 are text on those fills. Secondary text is `text-cpx-grey-500` (`#6E6E78`), body text in cells is `text-cpx-grey-700`, the hairline is `border-cpx-grey-100`, hover fills are `bg-cpx-grey-50`. Nothing uses `black/N` opacity greys any more.

**Banned outright: `#FDB913`, `#EA661F`, `#FFC72C`, `#F59E0B`.** The first three are the retired CPX yellow identity. The fourth is the Tailwind default amber, which sits **under 5 degrees of hue from `#FDB913` at effectively the same saturation and value**. It reads as the old identity, and status colour ships in persistent chrome on every screen.

### Two greens, and the reason

- **`#4CEE76`** is the action accent and the live status affordance **in chrome**: the primary button, the active nav wash and bar, the selected tab and chip, the row hover wash. It measures **1.52:1 on white**, so it only ever appears with a text label beside it; text on it is Dark Purple.
- **`#0F7E33`** (green-800, `green-contrast`) is green **wherever green must carry contrast alone**: chart series, coloured text, the tick in a copied state. 4.6:1 on white.

`#4CEE76` is never a series colour.

### Shell, shape and focus

The console wears the same light shell as every other CPX console: a white 60px top bar and a white 176px rail, both with a `#ECECEF` hairline, the active destination on a green-50 wash with a 3px green bar. Corners are 4px everywhere (`rounded-sm`), set once in the base layer. Cards are white with the hairline border and no shadow; menus, popovers and dialogs carry `shadow-pop`, the drawer `shadow-xl`.

One deliberate deviation from the CSD-007 guide: the keyboard focus outline stays Bright Purple (5.6:1), because a green ring is 1.5:1 on white and fails the 3:1 a focus indicator needs. Inputs still turn their border green on focus.

### Status, and the amber problem

**The CPX 2026 palette contains no amber.** We are not importing one. Status is a soft tinted pill with a hairline border, the CSD-007 ladder.

| State | Fill, border | Ink, icon and label |
|---|---|---|
| good, live | `#ECFEF2`, green-200 | `#0F7E33` check, label |
| needs attention (warn) | `#EFEFF9`, bright-200 | `#3C3C86` triangle, label |
| critical | `#FFD0DD`, red-200 | `#B00030` octagon, label |
| idle, unknown | `#DCDCE0`, grey-300 | `#2B2B34` dash, label |
| demonstration data | `#EBF9FF`, blue-100 | `#0276B0` triangle, label |

"Warn" is Bright Purple, the secondary brand colour, so a pending or waiting state never reads as an error; red is reserved for critical. **Colour never carries meaning alone.** Every status ships with an icon and a text label.

### Charts, when they come

Six categorical slots, fixed order, never cycled, all from the CPX scales: `#5C5CC0` · `#18A845` · `#0593DB` · `#1E1847` · `#F50E47` · `#6E6E78`. No orange, no yellow slot, deliberately.

Severity in a chart: critical `#D60039`, high `#FF7095`, medium `#14ABF5`, low `#BFBFC6`.

Seven PIR categories exceed the cap, so wherever they are the dimension use small multiples, never a seven-series stack.

Sequential ramp, the Bright Purple scale ending on Dark Purple: `#EFEFF9` `#DEDEF2` `#C2C2E8` `#9E9ED8` `#7B7BCB` `#5C5CC0` `#4A4AA6` `#3C3C86` `#1E1847`.

**Build charts as inline SVG in `components/chart/`. Do not add a charting library** - every one ships a default palette that will reintroduce the retired yellow.

---

## 3 · Type

Three families, self-hosted from `app/fonts/` through `next/font/local` (the CPX build runner has no egress to font CDNs; see `app/fonts/README.md`).

| Family | Token | Use |
|---|---|---|
| CPX Unbounded | `font-display` | Display only: `h1`, `h2`, the wordmark, KPI numbers. Never body copy. A small eyebrow `h2` opts out with `font-sans`. |
| Inter | `font-sans` (default) | Every other line of UI text, weight 400. `font-medium` carries emphasis. |
| IBM Plex Sans Arabic | `font-arabic` | Arabic content, headings and body alike. |

Headings 600 Semibold, `tracking-tightish` at `-0.01em`, like the other CPX consoles. The wordmark is Unbounded 700. No italics. **Never Arial on the web** - it is approved for Word and PowerPoint only.

**Eight sizes, nothing else.** The Tailwind default scale is wiped in `app/globals.css`; `text-[Npx]` is banned.

| Class | Size / line | Use |
|---|---|---|
| `text-2xs` | 11 / 16 | badges, pills, captions, table headers |
| `text-xs` | 12 / 16 | secondary meta |
| `text-sm` | 13 / 20 | body, table cells, buttons |
| `text-base` | 14 / 20 | nav, empty states, emphasis body (14px, not the Tailwind 16px) |
| `text-md` | 16 / 24 | dialog and section titles |
| `text-lg` | 18 / 24 | panel titles |
| `text-xl` | 20 / 28 | page `h1`, document titles |
| `text-2xl` | 28 / 32 | KPI numbers |

Buttons go through `Button` / `buttonClass` in `components/ui.tsx`, the CSD-007 recipes: primary (CPX Green, Dark Purple text, one per view), secondary (white outline), ghost, danger (red-700 outline, because Accent Red text fails AA on white). Modals go through `Dialog` / `Drawer` on the native `<dialog>`, which gives the focus trap, Escape and focus return for free.

---

## 4 · Imagery

The CPX brand explicitly rejects fear-based security imagery.

**Never:** locks, padlocks, shields, fingerprints, binary rain, matrix green text, hooded figures.
**Instead:** the pixel and building-block motif, block-based layouts, deconstructed brandmark fragments.

---

## 5 · The product mark

Four SVGs are supplied in `brand/mark/`, on one 24 viewBox. `brand/mark/preview.png` shows the pre-2026 tiled drawing and is now history only.

| File | Use |
|---|---|
| `mark-primary.svg` | Light surfaces, including the white top bar (served as `public/nestor-mark.svg`). Blocks `#1E1847`, chevron `#0F7E33`. **No tile.** |
| `mark-reverse.svg` | Dark Purple surfaces, such as the answer avatar. Blocks `#FFFFFF`, chevron `#4CEE76`, which carries 10.8:1 there. **Never apply a CSS invert filter** - it destroys the green. |
| `mark-mono.svg` | One-bit, print, or any cluster where green already carries a CTA. Uses `currentColor`. |
| `mark-16.svg` | Any use below 20px. Two courses instead of three, and heavier. Three courses do not hold at that size. The browser favicon is the CPX logo (`public/cpx-logo-primary.svg`), the same across every CPX console; the mark identifies Nestor inside the lockup. |

**Why the light mark carries green-800 and not `#4CEE76`.** The mark was drawn when the top bar was Dark Purple, so the light variant was the same art on a `#1E1847` tile, and the tile existed only to give the signature green a ground: `#4CEE76` is 1.5:1 on white. The bar is white now. A dark tile on it reads as a sticker, so the light variant drops the tile and the chevron takes `#0F7E33`, the contrast green section 2 already defines for exactly this case. The reverse variant keeps `#4CEE76`, because on Dark Purple it has the contrast to earn it.

`components/shell/NestorMark.tsx` inlines the same geometry for React, and `public/nestor-mark.svg` is a copy of the primary with no build step syncing it. Six files hold this drawing: change them together.

**The mark is "the Cairn":** six near-black blocks in three graduated courses, one then two then three, with a mitred CPX Green chevron as the apex. A marker built up out of many separate records, course by course, resolving to a single point that shows the way. Zero corner radius anywhere, all joins mitred, matching the CPX brandmark. It is none of shield, padlock, eye, binary or hooded figure.

**It survives a change of name**, which a monogram would not.

**Header lockup:**

```
[CPX primary logo 28px] │ [mark primary 24px] NESTOR  [● Live]
```

On the white top bar. The CPX wordmark reads as the parent, the mark as the tool. They do not compete.

---

## 6 · Motion

Motion is CSS only, from the tokens in `app/globals.css`. No animation library, no pulse, no loop: hard rule 4 bans a pulsing skeleton and anything that narrates work the system has not reported.

| Token | Value | Use |
|---|---|---|
| `ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Anything arriving or changing state |
| `ease-in-out-quart` | `cubic-bezier(0.76, 0, 0.24, 1)` | The rare thing that moves while visible |

| Where | Motion |
|---|---|
| Route change (`app/template.tsx`) | 120ms crossfade, no movement |
| Buttons, chips, tabs, rail items | `transition-colors duration-150`; buttons press to 98% |
| `IconChevronDown` | eased in the icon, once, for every disclosure |
| Disclosures, menus, popovers, notices | `reveal`: opacity and a 4px rise over 160ms via `@starting-style` |
| An answer landing | `reveal-up`: 200ms, 6px |
| Dialog, drawer, preview (`dialog[open]`) | entry only, 180 to 220ms; closing stays instant |
| Charts | draw once on arrival: slices fade, bars grow, lines trace. Never on hover or update |

Animate `opacity`, `translate`, `scale` and `stroke-dashoffset` only, never a layout property. Loading stays still: `SkeletonRows` and `AnswerSkeleton` hold the final geometry. Nothing animates on a keystroke or a filter. `prefers-reduced-motion: reduce` collapses every transition and animation to its final state, and programmatic scrolling snaps.

---

## 7 · The name

```
NESTOR · CPX Threat Intelligence
```

Uppercase, `-0.01em`, CPX Unbounded Bold, interpunct not a hyphen.

Nestor is the Homeric counsellor whose authority comes from accumulated experience across many years, consulted when the assembly needs a judgement. It entered English as a common noun meaning a wise elder adviser. That is the product: a multi-year, multi-source corpus consulted for judgement.

```ts
// lib/agent.ts
export const AGENT_ID = "AGT-CRS-002";        // internal only: never rendered as a badge
export const PRODUCT_NAME = "Nestor";
export const PRODUCT_SUBTITLE = "CPX Threat Intelligence";
```

**Nothing renders `02`, `AGT-CRS-002` or any agent number as an icon.** The previous build rendered the literal string `02` in a tile. It is non-injective across the twelve-agent programme and means nothing to a user.

**Three honest caveats, recorded so nobody is blindsided in a review:**

1. NESTOR is also the NSA-designated family of Vietnam-era voice encryption equipment. Obscure, long declassified, but a real collision in this domain.
2. "NESS-tor" is one phoneme from **Nessus**, which every security engineer in the room knows.
3. Homer mocks Nestor for long-windedness, and his counsel to Patroclus is what gets Patroclus killed.

**The name is not ratified by CPX.** It follows the Argus precedent: build branded, show it, treat silence as acceptance, then carry it into the BRD. **A formal trademark clearance search must run before the branded prototype is shown.** If CPX rejects it, only `PRODUCT_NAME` changes - the mark and every screen are unaffected. Standing alternate is PHAROS, subject to a registered mark held by Pharos Systems International.
