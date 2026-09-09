# Brand and copy

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

**Banned outright: `#FDB913`, `#EA661F`, `#FFC72C`, `#F59E0B`.** The first three are the retired CPX yellow identity. The fourth is the Tailwind default amber, which sits **under 5 degrees of hue from `#FDB913` at effectively the same saturation and value**. It reads as the old identity, and status colour ships in persistent chrome on every screen.

### Two greens, and the reason

- **`#4CEE76`** is the action accent and the live status affordance **in chrome**. It measures **1.52:1 on white**, so it only ever appears with a text label beside it, and status dots carry a 1px `#1E1847` ring.
- **`#00873D`** is green **wherever green must carry contrast alone**: chart series, fills, coloured text. 4.6:1 on white.

`#4CEE76` is never a series colour.

### Status, and the amber problem

**The CPX 2026 palette contains no amber.** We are not importing one.

| State | Fill | Icon and label |
|---|---|---|
| good, live | `#4CEE76` + 1px `#1E1847` ring | check, label |
| warning | `#FFD9E2` | `#C41E45` triangle, label |
| critical | `#FF3666` | white octagon, label |
| idle, unknown | `#9F9F9F` | dash, label |

**Colour never carries meaning alone.** Every status ships with an icon and a text label.

### Charts, when they come

Six categorical slots, fixed order, never cycled: `#5C5CC0` · `#00873D` · `#B5299E` · `#2A78D6` · `#D03B3B` · `#0F9BAF`. No orange, no yellow slot, deliberately.

Seven PIR categories exceed the cap, so wherever they are the dimension use small multiples, never a seven-series stack.

Sequential ramp, one hue on Dark Purple: `#EDEBF7` `#D5D1EE` `#B8B2E2` `#9A92D5` `#7C72C8` `#5C5CC0` `#46409B` `#2F2B72` `#1E1847`.

**Build charts as inline SVG in `components/chart/`. Do not add a charting library** - every one ships a default palette that will reintroduce the retired yellow.

---

## 3 · Type

**CPX Unbounded** for Latin, **IBM Plex Sans Arabic** for Arabic. Load via `next/font/google`.

Headings 500 Medium, `tracking-tightish` at `-0.01em`. Body 300 Light. No italics. **Never Arial on the web** - it is approved for Word and PowerPoint only.

---

## 4 · Imagery

The CPX brand explicitly rejects fear-based security imagery.

**Never:** locks, padlocks, shields, fingerprints, binary rain, matrix green text, hooded figures.
**Instead:** the pixel and building-block motif, block-based layouts, deconstructed brandmark fragments.

---

## 5 · The product mark

Four SVGs are supplied in `brand/mark/`. **Do not redraw them.** `brand/mark/preview.png` shows all four at size.

| File | Use |
|---|---|
| `mark-primary.svg` | Light surfaces. 32×32, the mark on a Dark Purple square tile. **The tile is a contrast fix, not decoration** - `#4CEE76` is 1.52:1 on white and 10.81:1 on `#1E1847`. The green must sit on purple. |
| `mark-reverse.svg` | The Dark Purple top bar. 24×24, no tile. **Never apply a CSS invert filter** - it destroys the green. |
| `mark-mono.svg` | One-bit, print, or any cluster where green already carries a CTA. Uses `currentColor`. |
| `mark-16.svg` | `app/icon.svg` and any use at 16px. Two courses instead of three. Three courses do not hold at that size. |

**The mark is "the Cairn":** six near-black blocks in three graduated courses, one then two then three, with a mitred CPX Green chevron as the apex. A marker built up out of many separate records, course by course, resolving to a single point that shows the way. Zero corner radius anywhere, all joins mitred, matching the CPX brandmark. It is none of shield, padlock, eye, binary or hooded figure.

**It survives a change of name**, which a monogram would not.

**Header lockup:**

```
[CPX reverse logo 28px] │ [mark reverse 24px] NESTOR ● Live
```

The CPX wordmark reads as the parent, the mark as the tool. They do not compete.

---

## 6 · The name

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
