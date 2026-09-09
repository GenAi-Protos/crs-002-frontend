# CPX web image (AGT-CICD §5.1, §9) — DEVIATION EX-003 (see security/exception-register.md).
# This UI is Next.js, so the CPX nginx-static Dockerfile.web (Vite dist/ -> nginx) does not
# apply. Instead: node build -> node runtime serving the Next standalone server on :8080 as the
# non-root `node` user, matching the web deploy-*.yml `--target-port 8080` and the `/` probe.
# Build context is this directory: `docker build app/frontend`.
#
# Public config (API_BASE_URL, ROLE_SWITCHER) is read at RUNTIME from the container env via
# lib/runtime-env.ts and injected into window.__ENV by the root layout. Set them as Container
# App env vars; no build args, no rebuild to change them.
FROM node:22-alpine AS build
# Clear fixable Alpine OS CVEs so the Trivy gate (--ignore-unfixed) has nothing fixable to block.
# Best-effort: the CPX runner's egress may block the Alpine CDN, and a failed upgrade must not
# kill the build (base-image freshness via `--pull` is the CVE fix path then).
RUN apk --no-cache upgrade || echo "apk upgrade skipped: Alpine CDN unreachable from this runner"
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
RUN apk --no-cache upgrade || echo "apk upgrade skipped: Alpine CDN unreachable from this runner"
# The standalone output bundles only the modules it needs; npm is unused at runtime, so remove
# its bundled CLI so its transitive CVEs do not ship.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# --chown so the non-root `node` user can read app files and write .next/cache at runtime.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
