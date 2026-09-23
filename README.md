# crs-ThreatIntel-web

## Overview
Frontend of **AGT-CRS-002**, CPX's threat intelligence agent (product name **Nestor**, under the CPX Threat Intelligence Center). An internal console for CPX TI analysts, the lead analyst, incident responders, leadership and sales. Clients never log in. The Next.js application lives in `app/frontend/`; the outer `app/` directory is the CPX deployment skeleton, not a route directory.

## Use Cases
- Threat Intelligence: PIR-driven collection, cited intelligence answers and advisory reporting (mirrors `metadata.yaml`).

## Architecture
- `app/frontend/` — Next.js 15 App Router, TypeScript, Tailwind v4. Seven destinations: Dashboard, Intelligence, Investigations, Reports, Clients, Collection, Manage. Screens use `lib/api.ts` and `lib/workspace-api.ts`. Dashboard, cases, query evidence, analyst submissions and IOC lookups have explicit loading/error states with no fixture fallback. Legacy screens retain a labelled offline fallback.
- Backend: `crs-ThreatIntel-api` (TODO(vendor): not yet created; the API contract this UI expects is listed in `app/frontend/docs/02-data.md`).
- Runtime configuration is read from the container environment at request time (`API_BASE_URL`, `ROLE_SWITCHER`; see `app/frontend/lib/runtime-env.ts`), so the image built on `dev` is promoted to `uat` unchanged.
- Container image: `app/frontend/Dockerfile` (`node:22-alpine`, Next standalone server on port 8080, non-root). Deviation EX-003 in `security/exception-register.md`.

## Local Development
```
cd app/frontend
npm ci
npm run dev          # http://localhost:3000, role switcher on via .env.development
npm run type-check   # tsc --noEmit
npm run lint
npm run build        # emits .next/standalone
```
Read `app/frontend/CLAUDE.md` before changing a screen.

## CPX Compliance
This repository follows the CPX Agentic AI Repository & CI/CD standard (AGT-CICD). Baseline
controls (workflows, CODEOWNERS, metadata, security/ops docs) must not be removed or relocated.
Any deviation is recorded in `security/exception-register.md` for CPX approval.
