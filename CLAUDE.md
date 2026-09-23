# crs-ThreatIntel-web — AGT-CRS-002 frontend (Nestor)

The Next.js app is at `app/frontend/`. The outer `app/` is the CPX deployment skeleton
(AGT-CICD), not a route directory. Everything under `.github/`, `infra/`, `apim/`, `security/`,
`ops/` and `metadata.yaml` is CPX baseline: do not move or delete it; record deviations in
`security/exception-register.md`.

Read `app/frontend/CLAUDE.md` before changing any screen. It carries the product rules
(seven destinations, roles, brand, copy limits, safety rules for the source inventory).

Runtime configuration is env-var driven and read at request time: `API_BASE_URL`,
`ROLE_SWITCHER` (see `app/frontend/lib/runtime-env.ts`). Never reintroduce `NEXT_PUBLIC_*`
for values that differ per environment: the dev image is promoted to uat unchanged.

Run from `app/frontend/`: `npm ci`, `npm run dev`, `npm run type-check`, `npm run lint`, `npm run build`.
