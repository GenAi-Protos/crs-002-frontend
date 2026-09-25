// Screens as a Teams tab shows them, for design review.
//
// Walks every destination (the dashboard once per role) in five frames:
//
//   teams90    a 1280x760 Teams tab at 90% zoom (1422x844 CSS px, DPR 0.9)
//   narrow90   a 1024x684 tab at 90% zoom, the chat pane open (1138x760, 0.9)
//   w1024      the worst case: 1024x720 at 100%
//   laptop150  a 1920x1080 screen at 150% scaling, browser chrome open
//   mobile     a 390x844 phone, DPR 2
//
// and asserts what a reviewer should not have to spot by eye: no horizontal
// overflow inside <main>, no blank scroll past the content, no page errors, and
// no text under WCAG AA contrast against the background it actually sits on.
// PNGs land in .ui-snapshots/<THEME>/ (git ignored). Needs the dev server and
// the backend running.
//
//   node scripts/ui-snapshots.mjs                 all frames, all routes
//   node scripts/ui-snapshots.mjs teams90 dash    one frame, routes matching "dash"
//   THEME=dark node scripts/ui-snapshots.mjs      the stored theme choice (light or dark)
//   REDUCED=1 node scripts/ui-snapshots.mjs       prefers-reduced-motion: reduce

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const THEME = process.env.THEME;
const OUT = fileURLToPath(
  new URL(`../.ui-snapshots/${process.env.SNAP_DIR ?? THEME ?? "default"}/`, import.meta.url),
);
const [onlyFrame, onlyRoute] = process.argv.slice(2);

const FRAMES = [
  { name: "teams90", viewport: { width: 1422, height: 844 }, deviceScaleFactor: 0.9 },
  { name: "narrow90", viewport: { width: 1138, height: 760 }, deviceScaleFactor: 0.9 },
  { name: "w1024", viewport: { width: 1024, height: 720 }, deviceScaleFactor: 1 },
  { name: "laptop150", viewport: { width: 1280, height: 660 }, deviceScaleFactor: 1.5 },
  { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
].filter((f) => !onlyFrame || onlyFrame === "all" || f.name === onlyFrame);

const get = async (path) => {
  const r = await fetch(`${API}${path}`, { headers: { "X-Nestor-User": "u-lead" } });
  return r.ok ? r.json() : null;
};
const cases = await get("/investigations");
const sources = await get("/collection/sources");
const caseId = cases?.items?.[0]?.id;
const sourceId = sources?.items?.[0]?.id ?? "src-125";

const ROUTES = [
  ...["analyst", "lead-analyst", "incident-responder", "leadership", "executive", "sales"].map((role) => ({
    name: `dash-${role}`,
    path: "/",
    role,
  })),
  { name: "dash-lead-threats", path: "/?tab=threats" },
  { name: "dash-lead-operations", path: "/?tab=operations" },
  { name: "intelligence", path: "/intelligence" },
  { name: "investigations", path: "/investigations" },
  ...(caseId ? [{ name: "investigation-detail", path: `/investigations/${caseId}` }] : []),
  { name: "reports", path: "/reports" },
  { name: "report-detail", path: "/reports/CPX-TIC-IA-2026-352" },
  { name: "clients", path: "/clients" },
  { name: "collection-connectors", path: "/collection" },
  { name: "collection-sources", path: "/collection?tab=sources" },
  { name: "collection-watches", path: "/collection?tab=watches" },
  { name: "collection-requests", path: "/collection?tab=requests" },
  { name: "source-detail", path: `/collection/sources/${sourceId}` },
  { name: "manage-pirs", path: "/manage" },
  { name: "manage-audit", path: "/manage?tab=audit" },
].filter((r) => !onlyRoute || r.name.includes(onlyRoute));

// WCAG AA text contrast, run in the page: every visible text node against the
// background it sits on (ancestors composited until one is opaque). Colours
// are resolved by painting them on a 1px canvas, so light-dark(), color-mix()
// and oklab all come back as sRGB. Disabled, aria-hidden and fully transparent
// text is exempt, as WCAG exempts it; text over an image or gradient is skipped.
function lowContrast() {
  const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", {
    willReadFrequently: true,
  });
  const cache = new Map();
  const rgba = (css) => {
    if (!cache.has(css)) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      cache.set(css, [r, g, b, a / 255]);
    }
    return cache.get(css);
  };
  // `top` composited over `under`, both [r, g, b, alpha].
  const over = (top, under) => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const background = (el) => {
    let bg = [0, 0, 0, 0];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return null;
      bg = over(bg, rgba(cs.backgroundColor));
      if (bg[3] >= 0.99) return bg;
    }
    return over(bg, [255, 255, 255, 1]);
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el) continue;
    if (el.closest("script, style, noscript, [aria-hidden='true'], :disabled, [aria-disabled='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") continue;
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
    if (opacity < 0.05) continue;
    const bg = background(el);
    if (!bg) continue;
    const ink = rgba(el.closest("svg") ? cs.fill : cs.color);
    const fg = over([ink[0], ink[1], ink[2], ink[3] * opacity], bg);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} "${text.slice(0, 24)}"`);
  }
  return [...new Set(out)];
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];

for (const frame of FRAMES) {
  for (const route of ROUTES) {
    const context = await browser.newContext({
      viewport: frame.viewport,
      deviceScaleFactor: frame.deviceScaleFactor,
      isMobile: frame.isMobile,
      hasTouch: frame.hasTouch,
      reducedMotion: process.env.REDUCED ? "reduce" : "no-preference",
      colorScheme: THEME === "dark" ? "dark" : "light",
    });
    const role = route.role ?? "lead-analyst";
    await context.addInitScript(
      ([r, t]) => {
        sessionStorage.setItem("nestor-role", r);
        if (t) localStorage.setItem("nestor:theme", t);
      },
      [role, THEME],
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // The role provider renders as the analyst for one tick before the stored
    // role applies (lib/role-context.tsx), so a 403 on first load is expected.
    page.on("console", (m) => m.type() === "error" && !/status of 403/.test(m.text()) && errors.push(m.text()));
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 90_000 }).catch((e) => errors.push(String(e)));
    // Let arrivals settle (the longest stagger is 240ms + 220ms).
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => {
      const m = document.querySelector("main");
      if (!m) return null;
      const edge = m.getBoundingClientRect().right;
      const wide = [...m.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > edge + 1 && getComputedStyle(el).visibility !== "hidden";
        })
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")}`);
      // Dead scroll: <main> scrolling past the end of its in-flow content,
      // which only an out-of-flow box (a tooltip, an sr-only table) can do.
      const top = m.getBoundingClientRect().top - m.scrollTop;
      const inFlow = (el) => {
        for (let e = el; e && e !== m; e = e.parentElement) {
          if (["absolute", "fixed"].includes(getComputedStyle(e).position)) return false;
        }
        return true;
      };
      const flow = Math.max(
        0,
        ...[...m.querySelectorAll("*")].filter(inFlow).map((el) => el.getBoundingClientRect().bottom - top),
      );
      const dead = Math.round(m.scrollHeight - Math.max(m.clientHeight, flow));
      return { scroll: m.scrollWidth - m.clientWidth, wide, dead };
    });
    const contrast = await page.evaluate(lowContrast);
    const file = `${OUT}${frame.name}-${route.name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    // The scroll region is <main>, so a full-page shot is taken by growing the
    // frame to the content's height.
    const height = await page.evaluate(() => document.querySelector("main")?.scrollHeight ?? 0);
    if (height > frame.viewport.height) {
      await page.setViewportSize({ width: frame.viewport.width, height: Math.min(height + 60, 6000) });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}${frame.name}-${route.name}-full.png` });
    }
    const line = `${frame.name.padEnd(9)} ${route.name.padEnd(24)} overflow ${overflow?.scroll ?? "-"}px dead ${overflow?.dead ?? "-"}px contrast ${contrast.length}${
      overflow?.wide?.length ? ` [${overflow.wide.join(", ")}]` : ""
    }${contrast.length ? `  low: ${contrast.slice(0, 4).join(" | ")}` : ""}${
      errors.length ? `  errors: ${errors.slice(0, 2).join(" | ").slice(0, 200)}` : ""
    }`;
    console.log(line);
    if ((overflow?.scroll ?? 0) > 0 || (overflow?.dead ?? 0) > 4 || contrast.length || errors.length)
      problems.push(line);
    await context.close();
  }
}
// MOTION=1: the entrance, reduced motion and refresh behaviour of the dashboard.
if (process.env.MOTION) {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1422, height: 844 },
      deviceScaleFactor: 0.9,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => sessionStorage.setItem("nestor-role", "lead-analyst"));
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("section.enter", { timeout: 60_000 });
    for (const t of reduced ? [0] : [0, 120, 260]) {
      if (t) await page.waitForTimeout(t === 120 ? 120 : 140);
      await page.screenshot({ path: `${OUT}motion-${reduced ? "reduced" : "full"}-${t}ms.png` });
    }
    if (reduced) {
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll(".enter")].filter((el) => Number(getComputedStyle(el).opacity) < 1).length,
      );
      const line = `reduced motion: ${hidden} panel(s) not fully visible at first paint`;
      console.log(line);
      if (hidden) problems.push(line);
    } else {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      const before = await page.locator('[aria-label="Loading"]').count();
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      let flashed = 0;
      for (let i = 0; i < 20; i += 1) {
        flashed = Math.max(flashed, await page.locator('[aria-label="Loading"]').count());
        await page.waitForTimeout(25);
      }
      const line = `refresh: ${flashed - before} skeleton(s) appeared while refetching`;
      console.log(line);
      if (flashed > before) problems.push(line);
    }
    await context.close();
  }
}

await browser.close();
console.log(problems.length ? `\n${problems.length} frame(s) need attention` : "\nAll frames clean.");
process.exitCode = problems.length ? 1 : 0;
