# Nestor · CPX Threat Intelligence Console

Frontend for **AGT-CRS-002**. Next.js App Router + TypeScript + Tailwind v4. Screens read the backend through `lib/api.ts` and `lib/workspace-api.ts` (runtime env var `API_BASE_URL`). The current dashboard, shared investigations, evidence uploads, analyst source submissions and IOC lookup use live backend contracts with explicit error states. Legacy screens retain a labelled offline fixture fallback.

Start with **`CLAUDE.md`**. Then `docs/01-screens.md`.

Validate with `npm run type-check`, `npm run lint`, `npm run build`, then
`npm run test:workspace` against an isolated local backend. See
[workspace acceptance](docs/06-workspace-verification.md) for setup and coverage.

```
CLAUDE.md      the rules, the seven destinations, the build order
docs/01        screen by screen, with layouts
docs/02        types and fixtures
docs/03        brand tokens, the mark, and the writing rules
docs/04        confirm list, attribution, safety
data/          CPX's PIR workbook, extracted verbatim
fixtures/      pirs.json is supplied and correct. Build the rest to docs/02.
brand/         the CPX 2026 logos and the four Nestor mark SVGs
```
