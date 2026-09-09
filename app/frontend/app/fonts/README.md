# Fonts

Self-hosted web fonts, loaded by `app/layout.tsx` through `next/font/local`. Nothing is
fetched at build time: the CPX build runner has no egress to font CDNs.

| File | Family | Role | Licence |
|---|---|---|---|
| `unbounded-latin-wght-normal.woff2` | Unbounded (variable, 200 to 900) | Display: h1, h2, wordmark, KPI numbers | SIL OFL 1.1 |
| `inter-latin-wght-normal.woff2` | Inter (variable, 100 to 900) | Body and every line of UI text | SIL OFL 1.1 |
| `ibm-plex-sans-arabic-arabic-400-normal.woff2`, `-500-normal.woff2` | IBM Plex Sans Arabic | Arabic content, not preloaded | SIL OFL 1.1 |

Source builds: fontsource (`@fontsource-variable/unbounded`, `@fontsource-variable/inter`,
`@fontsource/ibm-plex-sans-arabic`, v5) via jsDelivr.

## Swapping in the licensed CPX cut

CPX Unbounded ships in `cpx-brand-guidelines/03-Fonts/Latin/CPX Unbounded/` as static
weights (ExtraLight to Black). To use it, put the woff2 files here and change the
`unbounded` declaration in `app/layout.tsx` to a `src: [...]` list with one entry per
weight. The CSS variable and every class stay the same.
