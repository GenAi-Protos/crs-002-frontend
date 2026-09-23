# Workspace acceptance

Run `npm run type-check`, `npm run lint` and `npm run build` before browser acceptance.

The repeatable browser journey uses actual backend responses. It creates sources,
files, private conversations, cases and report versions, and exercises approval.
Use an isolated local backend with a temporary JSON store, `NESTOR_PROVIDER=fake`,
mock reputation and the scheduler disabled. Never point it at a shared development
store. Authentication and production deployment are outside this feature slice.

1. Start the isolated backend on `127.0.0.1:8001` using the backend README.
2. Set `API_BASE_URL=http://127.0.0.1:8001` and `ROLE_SWITCHER=true` for the frontend,
   then run `npm run dev -- --port 3001` in another terminal.
3. Run `npm ci`, then `npx playwright install chromium` once if Chromium is absent.
4. Run `npm run test:workspace`.

Optional variables: `WORKSPACE_BASE_URL`, `WORKSPACE_API_URL`,
`WORKSPACE_TEST_ARTIFACTS` and `WORKSPACE_HEADED=true`. URLs must be localhost.
Screenshots and results go into an OS temporary directory by default. Tests use
unique record titles and leave the isolated test store intact for inspection.

Coverage includes six distinct role dashboards, source validation/upload and
search, owner-private query uploads, explicit query-to-case evidence promotion,
source selection, specialist execution, report Save/reload, submit/send-back/
approval/update, IOC lookup and case handoff, Reports-to-Investigation RFI entry,
and narrow-screen modal focus/Escape behavior. Backend regression
tests cover revision races, scoped retrieval, extraction formats, provenance,
provider readiness and stale report approval.

Verification on 23 September 2026: all eight browser journeys passed against an
isolated fake-provider backend, including a named-client query, attachment follow-up
and explicit case promotion. No browser runtime errors were recorded. Laptop and
390px-wide modal screenshots were reviewed. The source modal also checks the Low
confidence default and all seven supported source categories.

Final `npm run type-check`, `npm run lint` and `npm run build` passed after the
last UI changes. A focused browser check reconfirmed the source defaults,
category selection, laptop/narrow layout and Escape dismissal. Next.js emitted
the existing workspace-root warning because the outer workspace also has a
package lockfile; the build completed successfully.
