# Nestor · CPX Threat Intelligence Console

Frontend for **AGT-CRS-002**. Next.js App Router + TypeScript + Tailwind v4. Screens read the backend through `lib/api.ts` (runtime env var `API_BASE_URL`); `fixtures/` is the offline fallback and is labelled as such on screen.

Start with **`CLAUDE.md`**. Then `docs/01-screens.md`.

```
CLAUDE.md      the rules, the six destinations, the build order
docs/01        screen by screen, with layouts
docs/02        types and fixtures
docs/03        brand tokens, the mark, and the writing rules
docs/04        confirm list, attribution, safety
data/          CPX's PIR workbook, extracted verbatim
fixtures/      pirs.json is supplied and correct. Build the rest to docs/02.
brand/         the CPX 2026 logos and the four Nestor mark SVGs
```
